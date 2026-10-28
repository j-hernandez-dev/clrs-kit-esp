export const BrokerTerminalCommandType =
    Object.freeze({
        ROOT: "root",
        HELP: "help",
        NEW_CONTRACT: "new_contract",
        DELETE_CONTRACT: "delete_contract",
        ACCEPT_CONTRACT: "accept_contract",
        PURGE_CONTRACTS: "purge_contracts",
        LIST_CONTRACTS: "list_contracts",
        READ_CONTRACT: "read_contract",
        REVIEW_CODE: "review_code",
        ASK_CODE: "ask_code",
        PUSH_CODE: "push_code",
        INFO: "info",
        GAME_INFO: "game_info"
    });

export const BrokerTerminalOption =
    Object.freeze({
        HELP: "-?",
        NEW: "-new",
        DELETE: "-delete",
        SET: "-set",
        PURGE: "-purge",
        GET: "-get",
        READ: "-read",
        REVIEW: "-review",
        ASK: "-ask",
        PUSH: "-push",
        INFO: "-info",
        GAME_INFO: "-gameinfo"
    });

const COMMAND_DEFINITIONS = Object.freeze([
    definition({
        option: BrokerTerminalOption.HELP,
        type: BrokerTerminalCommandType.HELP
    }),
    definition({
        option: BrokerTerminalOption.NEW,
        type:
            BrokerTerminalCommandType
                .NEW_CONTRACT,
        maximumArguments: 1,
        requiresLlm: true
    }),
    definition({
        option: BrokerTerminalOption.DELETE,
        type:
            BrokerTerminalCommandType
                .DELETE_CONTRACT,
        minimumArguments: 1,
        maximumArguments: 1
    }),
    definition({
        option: BrokerTerminalOption.SET,
        type:
            BrokerTerminalCommandType
                .ACCEPT_CONTRACT,
        minimumArguments: 1,
        maximumArguments: 1
    }),
    definition({
        option: BrokerTerminalOption.PURGE,
        type:
            BrokerTerminalCommandType
                .PURGE_CONTRACTS
    }),
    definition({
        option: BrokerTerminalOption.GET,
        type:
            BrokerTerminalCommandType
                .LIST_CONTRACTS
    }),
    definition({
        option: BrokerTerminalOption.READ,
        type:
            BrokerTerminalCommandType
                .READ_CONTRACT,
        minimumArguments: 1,
        maximumArguments: 1
    }),
    definition({
        option: BrokerTerminalOption.REVIEW,
        type:
            BrokerTerminalCommandType
                .REVIEW_CODE,
        maximumArguments: 1,
        requiresLlm: true,
        requiresActiveDocument: true
    }),
    definition({
        option: BrokerTerminalOption.ASK,
        type:
            BrokerTerminalCommandType
                .ASK_CODE,
        maximumArguments: 1,
        requiresLlm: true,
        requiresActiveDocument: true
    }),
    definition({
        option: BrokerTerminalOption.PUSH,
        type:
            BrokerTerminalCommandType
                .PUSH_CODE,
        maximumArguments: 1,
        requiresLlm: true,
        requiresActiveDocument: true
    }),
    definition({
        option: BrokerTerminalOption.INFO,
        type: BrokerTerminalCommandType.INFO
    }),
    definition({
        option: BrokerTerminalOption.GAME_INFO,
        type: BrokerTerminalCommandType.GAME_INFO
    })
]);

export const BROKER_TERMINAL_COMMANDS =
    COMMAND_DEFINITIONS;

const COMMAND_BY_OPTION = Object.freeze(
    Object.fromEntries(
        COMMAND_DEFINITIONS.map(command => [
            command.option,
            command
        ])
    )
);

export function getBrokerTerminalCommand(
    option
) {
    return COMMAND_BY_OPTION[option] ?? null;
}

export function createBrokerTerminalCommand({
    type,
    option = null,
    arguments: commandArguments = [],
    risk = null,
    contractId = null,
    documentSelector = null,
    question = null,
    requiresLlm = false,
    requiresActiveDocument = false,
    rawInput,
    normalizedInput
}) {
    return Object.freeze({
        type,
        root: "ai",
        option,
        arguments: Object.freeze([
            ...commandArguments
        ]),
        risk,
        contractId,
        documentSelector,
        question,
        requiresLlm,
        requiresActiveDocument,
        rawInput,
        normalizedInput
    });
}

function definition(options) {
    return Object.freeze({
        minimumArguments: 0,
        maximumArguments: 0,
        requiresLlm: false,
        requiresActiveDocument: false,
        ...options
    });
}
