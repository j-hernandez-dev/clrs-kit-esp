import {
    createHash,
    randomUUID
} from "node:crypto";

import {
    requireFunction,
    requirePort
} from "../../application/ports/ApplicationPorts.js";
import {
    BrokerOperationCoordinator,
    createBrokerOperationFingerprint
} from "../application/BrokerOperationCoordinator.js";
import {
    addBrokerContract
} from "../core/BrokerStateTransition.js";
import {
    BrokerContractType
} from "../core/BrokerContract.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    BROKER_RISKS,
    getBrokerRiskRule
} from "../core/BrokerRiskRules.js";
import {
    requireBrokerPayPotential
} from "../core/BrokerPaymentRules.js";
import {
    assertBrokerLlmAvailable
} from "../llm/BrokerLlmAvailability.js";
import {
    isBrokerLLMPlainRecord
} from "../llm/BrokerLLMProtocol.js";
import {
    BrokerCategorySelector
} from "../catalog/BrokerCategorySelector.js";
import {
    BROKER_CONTRACT_GENERATION_MAX_ATTEMPTS,
    createBrokerContractGenerationRequest
} from "./BrokerContractGenerationRequest.js";
import {
    brokerContractValidator
} from "./BrokerContractValidator.js";

export class BrokerContractService {

    constructor(options = {}) {
        this.gameSession = requirePort(
            options.gameSession,
            "brokerGameSession",
            ["initialize", "getState", "transact"]
        );
        this.llm = requirePort(
            options.llm,
            "brokerLlmPort",
            ["generateContract"]
        );
        this.availability = requirePort(
            options.availability,
            "brokerLlmAvailability",
            ["getSnapshot"]
        );
        this.random = requireFunction(
            options.random ?? Math.random,
            "brokerContractRandom"
        );
        this.categorySelector = options.categorySelector ??
            new BrokerCategorySelector({
                random: this.random
            });
        requirePort(
            this.categorySelector,
            "brokerCategorySelector",
            ["select"]
        );
        this.validator = requirePort(
            options.validator ?? brokerContractValidator,
            "brokerContractValidator",
            ["validate"]
        );
        this.now = requireFunction(
            options.now ?? Date.now,
            "brokerContractClock"
        );
        this.createRequestId = requireFunction(
            options.createRequestId ??
                defaultRequestId,
            "createBrokerContractRequestId"
        );
        this.operations = requirePort(
            options.operationCoordinator ??
                new BrokerOperationCoordinator(),
            "brokerContractOperations",
            ["execute"]
        );
    }

    async generate(source = {}) {
        const options = normalizeOptions(source);
        const requestId = options.requestId ??
            this.createRequestId();

        return this.operations.execute(
            {
                operation: "contract/generate",
                requestId,
                fingerprint:
                    createBrokerOperationFingerprint({
                        risk: options.risk,
                        excludeCategoryIds:
                            options.excludeCategoryIds
                    }),
                lane: "contract-generation"
            },
            () => this.#generate({
                ...options,
                requestId
            })
        );
    }

    async #generate(options) {

        await this.gameSession.initialize();

        const state = this.gameSession.getState();
        const risk = options.risk ??
            selectRisk(this.random);
        const selected = this.categorySelector.select({
            risk,
            history: state.categoryHistory,
            excludeCategoryIds:
                options.excludeCategoryIds
        });
        const payPotential = selectPayPotential(
            risk,
            this.random
        );
        const availability = this.availability
            .getSnapshot();

        assertBrokerLlmAvailable(
            availability.llmStatus
        );

        const request =
            createBrokerContractGenerationRequest({
                requestId: options.requestId,
                model: availability.settings.model,
                risk,
                category: selected.category
            });
        const generation =
            await this.#generateValidContent(
                request,
                {
                    model:
                        availability.settings.model,
                    risk,
                    category: selected.category
                }
            );
        const {
            result,
            content
        } = generation;
        const draft = Object.freeze({
            contractType:
                BrokerContractType.CLIENT,
            title: content.title,
            categoryId: selected.category.categoryId,
            categoryName: selected.category.categoryName,
            familyId: selected.category.familyId,
            familyName: selected.category.familyName,
            risk,
            description: content.description,
            requirements: content.requirements,
            testCases: content.testCases,
            client: content.client,
            payPotential,
            createdAt: normalizeTimestamp(this.now()),
            metadata: Object.freeze({
                requirementIds: Object.freeze(
                    [...content.requirementIds]
                ),
                generation: Object.freeze({
                    categoryOrdinal:
                        selected.category.ordinal,
                    candidateCount:
                        selected.candidateCount,
                    selectedWeight:
                        selected.selectedWeight,
                    responseId:
                        result.responseId ?? null,
                    providerId:
                        result.providerId,
                    model: result.model,
                    attempts:
                        generation.attempts,
                    repaired:
                        generation.attempts > 1
                })
            })
        });
        let contractId = null;
        const next = await this.gameSession.transact(
            (current, transitionOptions) => {
                contractId = current.nextContractId;

                return addBrokerContract(
                    current,
                    draft,
                    transitionOptions
                );
            }
        );
        const contract = next.contracts.find(
            item => item.id === contractId
        );

        if (!contract) {
            throw new Error(
                "BROKER.95 contract transaction did not persist its contract."
            );
        }

        return Object.freeze({
            contract,
            selection: Object.freeze({
                risk,
                category: selected.category,
                candidateCount:
                    selected.candidateCount
            }),
            stateRevision: next.revision
        });
    }

    async #generateValidContent(
        request,
        context
    ) {
        const firstResult =
            await this.llm.generateContract(
                request
            );
        const firstOutput =
            requireGenerationOutput(
                firstResult
            );

        try {
            return Object.freeze({
                result: firstResult,
                content: this.validator.validate(
                    firstOutput,
                    { risk: context.risk }
                ),
                attempts: 1
            });
        } catch (error) {
            if (!isRepairableDraftError(error)) {
                throw error;
            }

            const repairRequest =
                createBrokerContractGenerationRequest({
                    requestId: repairRequestId(
                        request.requestId
                    ),
                    model: context.model,
                    risk: context.risk,
                    category: context.category,
                    repair: {
                        attempt:
                            BROKER_CONTRACT_GENERATION_MAX_ATTEMPTS,
                        validationCode:
                            error.code,
                        previousDraft:
                            boundedRepairDraft(
                                firstOutput
                            )
                    }
                });
            const repairResult =
                await this.llm.generateContract(
                    repairRequest
                );
            const repairedContent =
                this.validator.validate(
                    requireGenerationOutput(
                        repairResult
                    ),
                    { risk: context.risk }
                );

            return Object.freeze({
                result: repairResult,
                content: repairedContent,
                attempts:
                    BROKER_CONTRACT_GENERATION_MAX_ATTEMPTS
            });
        }
    }
}

export function selectBrokerPayPotential(risk, random = Math.random) {
    return selectPayPotential(risk, random);
}

function normalizeOptions(source) {
    if (
        source == null ||
        typeof source !== "object" ||
        Array.isArray(source) ||
        Object.keys(source).some(key => ![
            "risk",
            "excludeCategoryIds",
            "requestId"
        ].includes(key))
    ) {
        invalid(
            "BROKER95_CONTRACT_GENERATION_OPTIONS_INVALID"
        );
    }

    if (source.risk != null) {
        getBrokerRiskRule(source.risk);
    }

    if (
        source.excludeCategoryIds != null &&
        !Array.isArray(source.excludeCategoryIds)
    ) {
        invalid(
            "BROKER95_CONTRACT_GENERATION_OPTIONS_INVALID"
        );
    }

    if (
        source.requestId != null &&
        (
            typeof source.requestId !== "string" ||
            !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u
                .test(source.requestId)
        )
    ) {
        invalid(
            "BROKER95_CONTRACT_GENERATION_OPTIONS_INVALID"
        );
    }

    return Object.freeze({
        risk: source.risk ?? null,
        excludeCategoryIds: Object.freeze([
            ...(source.excludeCategoryIds ?? [])
        ]),
        requestId: source.requestId ?? null
    });
}

function selectRisk(random) {
    const draw = requireRandom(random());

    return BROKER_RISKS[Math.floor(
        draw * BROKER_RISKS.length
    )];
}

function selectPayPotential(risk, random) {
    const [minimum, maximum] = getBrokerRiskRule(risk)
        .payRange;
    const draw = requireRandom(random());
    const payPotential = minimum + Math.floor(
        draw * (maximum - minimum + 1)
    );

    return requireBrokerPayPotential(
        risk,
        payPotential
    );
}

function requireRandom(value) {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value >= 1
    ) {
        invalid("BROKER95_CONTRACT_RANDOM_INVALID");
    }

    return value;
}

function normalizeTimestamp(value) {
    if (
        !(
            typeof value === "number" &&
            Number.isFinite(value)
        ) &&
        !(
            typeof value === "string" &&
            value.trim().length > 0
        )
    ) {
        invalid("BROKER95_CONTRACT_CLOCK_INVALID");
    }

    return typeof value === "string"
        ? value.trim()
        : value;
}

function requireGenerationOutput(result) {
    if (
        result == null ||
        typeof result !== "object" ||
        Array.isArray(result) ||
        !Object.hasOwn(result, "output")
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CONTRACT_GENERATION_RESPONSE_INVALID",
            "CIPHER devolviÃ³ una respuesta de contrato no vÃ¡lida.",
            []
        );
    }

    return result.output;
}

function defaultRequestId() {
    return `contract:${randomUUID()}`;
}

function isRepairableDraftError(error) {
    if (!(error instanceof BrokerGameError)) {
        return false;
    }

    return [
        "BROKER95_CONTRACT_DRAFT_",
        "BROKER95_CONTRACT_REQUIREMENT_",
        "BROKER95_TEST_"
    ].some(prefix =>
        error.code?.startsWith(prefix)
    );
}

function boundedRepairDraft(value) {
    if (!isBrokerLLMPlainRecord(value)) {
        return null;
    }

    try {
        return JSON.stringify(value).length <= 65_536
            ? value
            : null;
    } catch {
        return null;
    }
}

function repairRequestId(requestId) {
    const suffix = ":repair";

    if (requestId.length + suffix.length <= 128) {
        return `${requestId}${suffix}`;
    }

    return `contract:repair:${createHash("sha256")
        .update(requestId, "utf8")
        .digest("hex")}`;
}

function invalid(code) {
    throw BrokerGameError.invalidRule(
        code,
        "No fue posible generar un contrato válido.",
        []
    );
}
