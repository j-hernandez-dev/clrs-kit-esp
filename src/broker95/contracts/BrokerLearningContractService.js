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
    addBrokerLearningContract
} from "../core/BrokerStateTransition.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    assertBrokerLlmAvailable
} from "../llm/BrokerLlmAvailability.js";
import {
    isBrokerLLMPlainRecord
} from "../llm/BrokerLLMProtocol.js";
import {
    brokerLearningCatalog
} from "../learning/BrokerLearningCatalog.js";
import {
    BrokerLearningRouteId,
    getBrokerLearningRouteTitle
} from "../learning/BrokerLearningRoutesProgress.js";
import {
    getBrokerLearningRouteAttemptContext
} from "../learning/BrokerLearningRoutesProgressTransition.js";
import {
    BROKER_CONTRACT_GENERATION_MAX_ATTEMPTS,
    BROKER_LEARNING_CONTRACT_GENERATION_MODE,
    createBrokerLearningContractGenerationRequest
} from "./BrokerContractGenerationRequest.js";
import {
    BrokerLearningContractValidator
} from "./BrokerLearningContractValidator.js";

export class BrokerLearningContractService {

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
        this.catalog = options.catalog ??
            brokerLearningCatalog;
        this.catalogs = Object.freeze({
            [BrokerLearningRouteId.PROGRAMMING]:
                options.catalogs?.[
                    BrokerLearningRouteId
                        .PROGRAMMING
                ] ?? this.catalog,
            [BrokerLearningRouteId.ALGORITHMS]:
                options.catalogs?.[
                    BrokerLearningRouteId
                        .ALGORITHMS
                ] ?? null
        });

        for (const [routeId, catalog] of
            Object.entries(this.catalogs)) {
            if (catalog == null) {
                continue;
            }

            requirePort(
                catalog,
                `brokerLearningCatalog:${routeId}`,
                [
                    "requireLesson",
                    "listLessons",
                    "getAccumulatedKnowledge"
                ]
            );
        }

        this.validator = requirePort(
            options.validator ??
                new BrokerLearningContractValidator({
                    catalogs: this.catalogs
                }),
            "brokerLearningContractValidator",
            ["validate"]
        );

        this.now = requireFunction(
            options.now ?? Date.now,
            "brokerLearningContractClock"
        );
        this.createRequestId = requireFunction(
            options.createRequestId ??
                defaultRequestId,
            "createBrokerLearningContractRequestId"
        );
        this.operations = requirePort(
            options.operationCoordinator ??
                new BrokerOperationCoordinator(),
            "brokerLearningContractOperations",
            ["execute"]
        );
    }

    async obtain(source = {}) {
        const options = normalizeOptions(source);
        const requestId = options.requestId ??
            this.createRequestId();

        return this.operations.execute(
            {
                operation:
                    "learning-contract/obtain",
                requestId,
                fingerprint:
                    createBrokerOperationFingerprint({
                        learningRouteId:
                            options.learningRouteId,
                        lessonId: options.lessonId
                    }),
                lane: "learning-contract-generation"
            },
            () => this.#obtain({
                ...options,
                requestId
            })
        );
    }

    async #obtain(options) {
        await this.gameSession.initialize();

        const state = this.gameSession.getState();
        const catalog = this.#requireRouteCatalog(
            options.learningRouteId
        );
        const lesson = catalog.requireLesson(
            options.lessonId
        );
        getBrokerLearningRouteAttemptContext(
            state.learningProgress,
            {
                routeId: options.learningRouteId,
                lessonId: lesson.id
            },
            { catalogs: this.catalogs }
        );
        const availability = this.availability
            .getSnapshot();

        assertBrokerLlmAvailable(
            availability.llmStatus
        );

        const request =
            createBrokerLearningContractGenerationRequest(
                {
                    requestId: options.requestId,
                    model:
                        availability.settings.model,
                    learningProgress:
                        state.learningProgress,
                    learningRouteId:
                        options.learningRouteId,
                    lessonId: lesson.id
                },
                {
                    catalogs: this.catalogs
                }
            );
        const generation =
            await this.#generateValidContent(
                request,
                options.learningRouteId,
                lesson.id,
                availability.settings.model
            );
        const createdAt = normalizeTimestamp(
            this.now()
        );
        const draft = Object.freeze({
            title: generation.content.title,
            description:
                generation.content.description,
            requirements:
                generation.content.requirements,
            testCases:
                generation.content.testCases,
            metadata: Object.freeze({
                requirementIds: Object.freeze([
                    ...generation.content
                        .requirementIds
                ]),
                generation: Object.freeze({
                    generationMode:
                        BROKER_LEARNING_CONTRACT_GENERATION_MODE,
                    responseId:
                        generation.result
                            .responseId ?? null,
                    providerId:
                        generation.result
                            .providerId,
                    model:
                        generation.result.model,
                    attempts:
                        generation.attempts,
                    repaired:
                        generation.attempts > 1
                })
            })
        });
        let contractId = null;
        const next =
            await this.gameSession.transact(
                current => {
                    contractId =
                        current.nextContractId;

                    return addBrokerLearningContract(
                        current,
                        lesson.id,
                        draft,
                        {
                            routeId:
                                options.learningRouteId,
                            createdAt,
                            catalogs: this.catalogs
                        }
                    );
                }
            );
        const contract = next.contracts.find(
            item => item.id === contractId
        );

        if (contract == null) {
            throw new Error(
                "BROKER.95 learning contract transaction did not persist its contract."
            );
        }

        return Object.freeze({
            contract,
            lesson: Object.freeze({
                learningRouteId:
                    contract.learningRouteId,
                routeTitle:
                    getBrokerLearningRouteTitle(
                        contract.learningRouteId
                    ),
                lessonId: lesson.id,
                lessonOrder: lesson.order,
                lessonTitle: lesson.title,
                sectionId: lesson.sectionId
            }),
            stateRevision: next.revision
        });
    }

    async #generateValidContent(
        request,
        learningRouteId,
        lessonId,
        model
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
                    { lessonId, request }
                ),
                attempts: 1
            });
        } catch (error) {
            if (!isRepairableDraftError(error)) {
                throw error;
            }

            const repairRequest =
                createBrokerLearningContractGenerationRequest(
                    {
                        requestId: repairRequestId(
                            request.requestId
                        ),
                        model,
                        learningProgress:
                            this.gameSession
                                .getState()
                                .learningProgress,
                        learningRouteId,
                        lessonId,
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
                    },
                    {
                        catalogs: this.catalogs
                    }
                );
            const repairResult =
                await this.llm.generateContract(
                    repairRequest
                );
            const content = this.validator.validate(
                requireGenerationOutput(
                    repairResult
                ),
                {
                    lessonId,
                    request: repairRequest
                }
            );

            return Object.freeze({
                result: repairResult,
                content,
                attempts:
                    BROKER_CONTRACT_GENERATION_MAX_ATTEMPTS
            });
        }
    }

    #requireRouteCatalog(learningRouteId) {
        const catalog = this.catalogs[
            learningRouteId
        ];

        if (catalog == null) {
            invalid(
                "BROKER95_LEARNING_ROUTE_NOT_CATALOGED",
                [{ learningRouteId }]
            );
        }

        return catalog;
    }
}

function normalizeOptions(source) {
    if (
        !isBrokerLLMPlainRecord(source) ||
        Object.keys(source).some(
            key =>
                ![
                    "learningRouteId",
                    "lessonId",
                    "requestId"
                ].includes(key)
        ) ||
        (
            source.learningRouteId != null &&
            !Object.values(
                BrokerLearningRouteId
            ).includes(source.learningRouteId)
        ) ||
        typeof source.lessonId !== "string" ||
        !/^(?:algorithm-)?lesson-[0-9]{3,}$/u
            .test(source.lessonId) ||
        (
            source.requestId != null &&
            (
                typeof source.requestId !==
                    "string" ||
                !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u
                    .test(source.requestId)
            )
        )
    ) {
        invalid(
            "BROKER95_LEARNING_CONTRACT_OPTIONS_INVALID"
        );
    }

    return Object.freeze({
        learningRouteId:
            source.learningRouteId ??
            BrokerLearningRouteId.PROGRAMMING,
        lessonId: source.lessonId,
        requestId: source.requestId ?? null
    });
}

function requireGenerationOutput(result) {
    if (
        !isBrokerLLMPlainRecord(result) ||
        !Object.hasOwn(result, "output")
    ) {
        invalid(
            "BROKER95_LEARNING_CONTRACT_RESPONSE_INVALID"
        );
    }

    return result.output;
}

function isRepairableDraftError(error) {
    if (!(error instanceof BrokerGameError)) {
        return false;
    }

    return [
        "BROKER95_LEARNING_CONTRACT_DRAFT_",
        "BROKER95_LEARNING_CONTRACT_CURRICULUM_",
        "BROKER95_LEARNING_CONTRACT_FUTURE_KNOWLEDGE",
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
        invalid(
            "BROKER95_LEARNING_CONTRACT_CLOCK_INVALID"
        );
    }

    return typeof value === "string"
        ? value.trim()
        : value;
}

function repairRequestId(requestId) {
    const suffix = ":repair";

    if (requestId.length + suffix.length <= 128) {
        return `${requestId}${suffix}`;
    }

    return `learning:repair:${createHash("sha256")
        .update(requestId, "utf8")
        .digest("hex")}`;
}

function defaultRequestId() {
    return `learning:${randomUUID()}`;
}

function invalid(code, diagnostics = []) {
    throw BrokerGameError.invalidRule(
        code,
        "Broker.95 no pudo preparar el contrato de aprendizaje. Inténtalo nuevamente.",
        diagnostics
    );
}
