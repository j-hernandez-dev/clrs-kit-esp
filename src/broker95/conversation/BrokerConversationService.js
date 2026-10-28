import {
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
    BrokerLLMOperation,
    BrokerLLMProtocolError,
    assertBrokerLlmAvailable,
    createChatRequest
} from "../llm/index.js";
import {
    BrokerChatMessageStreamDecoder
} from "./BrokerChatMessageStreamDecoder.js";
import {
    createBrokerConversationContext
} from "./BrokerConversationContext.js";

export const BrokerConversationOperation =
    Object.freeze({
        CHAT: "conversation/chat"
    });

/**
 * Caso de uso de conversación libre. Serializa solicitudes, obtiene únicamente
 * contexto determinista seguro y persiste el turno una vez validado completo.
 */
export class BrokerConversationService {

    constructor(options = {}) {
        this.gameSession = requirePort(
            options.gameSession,
            "brokerGameSession",
            ["initialize", "getState"]
        );
        this.conversationSession =
            requirePort(
                options.conversationSession,
                "brokerConversationSession",
                [
                    "initialize",
                    "getState",
                    "getLlmMessages",
                    "appendTurn"
                ]
            );
        this.llm = requirePort(
            options.llm,
            "brokerLlmPort",
            ["chat"]
        );
        this.availability = requirePort(
            options.availability,
            "brokerLlmAvailability",
            ["getSnapshot"]
        );
        this.createRequestId = requireFunction(
            options.createRequestId ??
                defaultRequestId,
            "createBrokerConversationRequestId"
        );
        this.operations = requirePort(
            options.operationCoordinator ??
                new BrokerOperationCoordinator(),
            "brokerConversationOperations",
            ["execute"]
        );
    }

    async chat(source = {}) {
        const options = normalizeOptions(source);
        const requestId = options.requestId ??
            this.createRequestId();

        return this.operations.execute(
            {
                operation:
                    BrokerConversationOperation.CHAT,
                requestId,
                fingerprint:
                    createBrokerOperationFingerprint({
                        message: options.message
                    }),
                lane: "conversation"
            },
            () => this.#chat({
                ...options,
                requestId
            })
        );
    }

    async #chat(options) {
        requireNotAborted(options.signal);

        await Promise.all([
            this.gameSession.initialize(),
            this.conversationSession
                .initialize()
        ]);

        requireNotAborted(options.signal);

        const availability = this.availability
            .getSnapshot();

        assertBrokerLlmAvailable(
            availability.llmStatus
        );

        const conversationState =
            this.conversationSession
                .getState();
        const requestSource = Object.freeze({
            requestId:
                options.requestId,
            model: availability.settings.model,
            input: Object.freeze({
                message: options.message
            }),
            context:
                createBrokerConversationContext(
                    this.gameSession.getState()
                ),
            conversation:
                this.conversationSession
                    .getLlmMessages(),
            stream: true
        });
        const request = createChatRequest(
            requestSource
        );
        const decoder =
            new BrokerChatMessageStreamDecoder();
        let sequence = 0;
        const emit = async text => {
            if (
                text.length === 0 ||
                options.onDelta == null
            ) {
                return;
            }

            await options.onDelta(
                Object.freeze({
                    requestId:
                        request.requestId,
                    sequence,
                    text
                })
            );
            sequence += 1;
        };
        const result = await this.llm.chat(
            requestSource,
            {
                signal: options.signal,
                onDelta: async delta => {
                    await emit(
                        decoder.push(
                            delta.text
                        )
                    );
                }
            }
        );

        requireNotAborted(options.signal);

        const assistantMessage =
            requireAssistantMessage(result);
        const persisted =
            await this.conversationSession
                .appendTurn(
                    {
                        userContent:
                            options.message,
                        assistantContent:
                            assistantMessage
                    },
                    {
                        expectedRevision:
                            conversationState
                                .revision
                    }
                );

        await emit(
            decoder.finish(assistantMessage)
        );

        return Object.freeze({
            operation:
                BrokerConversationOperation.CHAT,
            requestId: request.requestId,
            message: assistantMessage,
            model: result.model,
            finishReason:
                result.finishReason,
            usage: result.usage,
            responseId:
                result.responseId,
            turnId: persisted.addedTurnId,
            conversationRevision:
                persisted.state.revision,
            trimmedTurnCount:
                persisted.trimmedTurnCount
        });
    }
}

function normalizeOptions(source) {
    if (
        source == null ||
        typeof source !== "object" ||
        Array.isArray(source) ||
        Object.keys(source).some(key =>
            ![
                "message",
                "requestId",
                "signal",
                "onDelta"
            ].includes(key)
        ) ||
        typeof source.message !== "string"
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("conversation");
    }

    if (
        source.requestId != null &&
        (
            typeof source.requestId !== "string" ||
            !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u
                .test(source.requestId)
        )
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest(
                "conversation.requestId"
            );
    }

    if (
        source.onDelta != null &&
        typeof source.onDelta !== "function"
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest(
                "conversation.onDelta"
            );
    }

    if (
        source.signal != null &&
        (
            typeof source.signal !== "object" ||
            typeof source.signal.aborted !==
                "boolean" ||
            typeof source.signal.addEventListener !==
                "function"
        )
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest(
                "conversation.signal"
            );
    }

    return Object.freeze({
        message: source.message,
        requestId: source.requestId ?? null,
        signal: source.signal ?? null,
        onDelta: source.onDelta ?? null
    });
}

function requireAssistantMessage(result) {
    const message = result?.output?.message;

    if (
        typeof message !== "string" ||
        message.trim().length === 0 ||
        message.length > 65_536 ||
        message.includes("\u0000")
    ) {
        throw BrokerLLMProtocolError
            .invalidResponse(
                "response.message"
            );
    }

    return message;
}

function requireNotAborted(signal) {
    if (signal?.aborted) {
        throw BrokerLLMProtocolError.aborted(
            BrokerLLMOperation.CHAT
        );
    }
}

function defaultRequestId() {
    return `chat:${randomUUID()}`;
}
