enum TokenType {
    OpenCurly,
    CloseCurly,
    OpenSquare,
    CloseSquare,
    OpenParen,
    CloseParen,
    Identifier,
    Period,
    Comma,
    Plus,
    Minus,
    Multiply,
    Divide,
    Equal,
    NotEqual,
    LessThan,
    LessThanOrEqual,
    GreaterThan,
    GreaterThanOrEqual,
    String,
    Number,
    Boolean
}

const orderedOperators = [
    TokenType.Divide,
    TokenType.Multiply,
    TokenType.Minus,
    TokenType.Plus,
    TokenType.Equal,
    TokenType.NotEqual,
    TokenType.LessThan,
    TokenType.LessThanOrEqual,
    TokenType.GreaterThan,
    TokenType.GreaterThanOrEqual
];

const literals = [
    TokenType.Identifier,
    TokenType.String,
    TokenType.Number,
    TokenType.Boolean
];

interface TokenizerRule {
    tokenType: TokenType;
    regEx: RegExp;
}

interface Token {
    type: TokenType;
    value: string;
    originalPosition: number;
}

class Tokenizer {
    static rules: Array<TokenizerRule> = [];

    static init() {
        Tokenizer.rules.push(
            { tokenType: undefined, regEx: /^\s/ },
            { tokenType: TokenType.OpenCurly, regEx: /^{/ },
            { tokenType: TokenType.CloseCurly, regEx: /^}/ },
            { tokenType: TokenType.OpenSquare, regEx: /^\[/ },
            { tokenType: TokenType.CloseSquare, regEx: /^\]/ },
            { tokenType: TokenType.OpenParen, regEx: /^\(/ },
            { tokenType: TokenType.CloseParen, regEx: /^\)/ },
            { tokenType: TokenType.Boolean, regEx: /^true|^false/ },
            { tokenType: TokenType.Identifier, regEx: /^[$a-z_]+/i },
            { tokenType: TokenType.Period, regEx: /^\./ },
            { tokenType: TokenType.Comma, regEx: /^,/ },
            { tokenType: TokenType.Plus, regEx: /^\+/ },
            { tokenType: TokenType.Minus, regEx: /^-/ },
            { tokenType: TokenType.Multiply, regEx: /^\*/ },
            { tokenType: TokenType.Divide, regEx: /^\// },
            { tokenType: TokenType.Equal, regEx: /^==/ },
            { tokenType: TokenType.NotEqual, regEx: /^!=/ },
            { tokenType: TokenType.LessThanOrEqual, regEx: /^<=/ },
            { tokenType: TokenType.LessThan, regEx: /^</ },
            { tokenType: TokenType.GreaterThanOrEqual, regEx: /^>=/ },
            { tokenType: TokenType.GreaterThan, regEx: /^>/ },
            { tokenType: TokenType.String, regEx: /^"([^"]*)"/ },
            { tokenType: TokenType.String, regEx: /^'([^']*)'/ },
            { tokenType: TokenType.Number, regEx: /^\d*\.?\d+/ }
        )
    }

    private _tokens: Array<Token>;

    protected internalParse(expression: string) {
        let i = 0;

        while (i < expression.length) {
            let subExpression = expression.substring(i);
            let matchFound = false;

            for (let rule of Tokenizer.rules) {
                let matches = rule.regEx.exec(subExpression);

                if (matches) {
                    if (matches.length > 2) {
                        throw new Error("A tokenizer rule matched more than one group.");
                    }

                    if (rule.tokenType != undefined) {
                        this._tokens.push(
                            {
                                type: rule.tokenType,
                                value: matches[matches.length == 1 ? 0 : 1],
                                originalPosition: i
                            }
                        )
                    }

                    i += matches[0].length;

                    matchFound = true;

                    break;
                }
            }

            if (!matchFound) {
                i++;
            }
        }
    }

    parse(expression: string) {
        this._tokens = [];

        this.internalParse(expression);
    }

    get tokens(): Array<Token> {
        return this._tokens;
    }
}

Tokenizer.init();

type LiteralValue = string | number | boolean;

abstract class ExpressionNode {
    abstract print(): string;
    abstract evaluate(context: Object): LiteralValue;
}

function ensureValueType(value: any): LiteralValue {
    if (typeof value === "number" || typeof value ==="string" || typeof value === "boolean") {
        return value;
    }

    throw new Error("Invalid value type: " + typeof value);
}


type FunctionCallback = (params: any[]) => any;
type FunctionDictionary = { [key: string]: FunctionCallback };

class ExpressionContext {
    private static _builtInFunctions: FunctionDictionary = {}
    
    static init() {
        ExpressionContext._builtInFunctions["substr"] = (params: any[]) => {
            return (<string>params[0]).substr(<number>params[1], <number>params[2]);
        };
    }

    private _functions = {};
    private _$data: any;

    $root: any;

    registerFunction(name: string, callback: FunctionCallback) {
        this._functions[name] = callback;
    }

    unregisterFunction(name: string) {
        delete this._functions[name];
    }

    getFunction(name: string): FunctionCallback {
        let result = this._functions[name];

        if (result == undefined) {
            result = ExpressionContext._builtInFunctions[name];
        }

        return result;
    }

    get $data(): any {
        return this._$data != undefined ? this._$data : this.$root;
    }

    set $data(value: any) {
        this._$data = value;
    }
}

ExpressionContext.init();

class Expression extends ExpressionNode {
    nodes: Array<ExpressionNode> = [];

    evaluate(context: ExpressionContext): any {
        const operatorPriorityGroups = [
            [ TokenType.Divide, TokenType.Multiply ],
            [ TokenType.Minus, TokenType.Plus ],
            [ TokenType.Equal, TokenType.NotEqual, TokenType.LessThan, TokenType.LessThanOrEqual, TokenType.GreaterThan, TokenType.GreaterThanOrEqual ]
        ];

        let nodesCopy = this.nodes;

        for (let priorityGroup of operatorPriorityGroups) {
            let i = 0;

            while (i < nodesCopy.length) {
                let node = nodesCopy[i];

                if (node instanceof OperatorNode && priorityGroup.indexOf(node.operator) >= 0) {
                    let left = ensureValueType(nodesCopy[i - 1].evaluate(context));
                    let right = ensureValueType(nodesCopy[i + 1].evaluate(context));

                    if (typeof left !== typeof right) {
                        throw new Error("Incompatible operands " + left + " and " + right + " for operator " + TokenType[node.operator]);
                    }

                    let result: LiteralValue;

                    if (typeof left === "number" && typeof right === "number") {
                        switch (node.operator) {
                            case TokenType.Divide:
                                result = left / right;
                                break;
                            case TokenType.Multiply:
                                result = left * right;
                                break;
                            case TokenType.Minus:
                                result = left - right;
                                break;
                            case TokenType.Plus:
                                result = left + right;
                                break;
                        }
                    }

                    if (typeof left === "string" && typeof right === "string") {
                        switch (node.operator) {
                            case TokenType.Plus:
                                result = left + right;
                                break;
                        }
                    }

                    switch (node.operator) {
                        case TokenType.Equal:
                            result = left == right;
                            break;
                        case TokenType.NotEqual:
                            result = left != right;
                            break;
                        case TokenType.LessThan:
                            result = left < right;
                            break;
                        case TokenType.LessThanOrEqual:
                            result = left <= right;
                            break;
                        case TokenType.GreaterThan:
                            result = left > right;
                            break;
                        case TokenType.GreaterThanOrEqual:
                            result = left >= right;
                            break;
                        default:
                            // This should never happen
                    }

                    nodesCopy.splice(i - 1, 3, new LiteralNode(result));

                    i--;
                }

                i++;
            };
        }

        return nodesCopy[0].evaluate(context);
    }

    print(): string {
        let result = "";

        for (let node of this.nodes) {
            if (result != "") {
                result += " ";
            }

            result += node.print();
        }

        return "(" + result + ")";
    }
}

type PropertyPathPart = string | Expression;

class PropertyPathNode extends ExpressionNode {
    properties: Array<PropertyPathPart> = [];

    evaluate(context: ExpressionContext): LiteralValue {
        let result: any;
        let index = 0;
        
        switch (<string>this.properties[0]) {
            case "$root":
                result = context.$root;
                index++;

                break;
            case "$data":
                result = context.$data;
                index++;

                break;
            default:
                result = context.$data;

                break;
        }

        while (index < this.properties.length) {
            let part = this.properties[index];

            try {
                if (typeof part === "string") {
                    result = result[part];
                }
                else {
                    result = result[part.evaluate(context)];
                }
            }
            catch {
                return undefined;
            }

            index++;
        }

        return result;
    }
    
    print(): string {
        let result = "";

        for (let part of this.properties) {
            if (typeof part === "string") {
                if (result != "") {
                    result += ".";
                }

                result += part;
            }
            else {
                result += "[" + part.print() + "]";
            }
        }

        return result;
    }
}

class FunctionCallNode extends ExpressionNode {
    functionName: string;
    parameters: Array<Expression> = [];

    evaluate(context: ExpressionContext): LiteralValue {
        let callback = context.getFunction(this.functionName);

        if (callback != undefined) {
            let evaluatedParams = [];

            for (let param of this.parameters) {
                evaluatedParams.push(param.evaluate(context));
            }

            return callback(evaluatedParams);
        }
    }
    
    print(): string {
        let result = "";

        for (let parameter of this.parameters) {
            if (result != "") {
                result += ", ";
            }

            result += parameter.print();
        }

        return this.functionName + "(" + result + ")";
    }
}

class LiteralNode extends ExpressionNode {
    constructor(readonly value: LiteralValue) {
        super();
    }

    evaluate(context: ExpressionContext): LiteralValue {
        return this.value;
    }
    
    print(): string {
        return this.value.toString();
    }
}

class OperatorNode extends ExpressionNode {
    constructor(readonly operator: TokenType) {
        super();
    }

    evaluate(context: ExpressionContext): LiteralValue {
        throw new Error("An operator cannot be evaluated on its own.");
    }
    
    print(): string {
        switch (this.operator) {
            case TokenType.Plus:
                return "+";
            case TokenType.Minus:
                return "-";
            case TokenType.Multiply:
                return "*";
            case TokenType.Divide:
                return "/";
            case TokenType.Equal:
                return "==";
            case TokenType.NotEqual:
                return "!=";
            case TokenType.LessThan:
                return "<";
            case TokenType.LessThanOrEqual:
                return "<=";
            case TokenType.GreaterThan:
                return ">";
            case TokenType.GreaterThanOrEqual:
                return ">=";
            default:
                return TokenType[this.operator];
        }
    }
}

class ExpressionParser {
    private _index: number = 0;

    private unexpectedToken() {
        throw new Error("Unexpected token " + this.current.value + " at position " + this.current.originalPosition + ".");
    }

    private unexpectedEoe() {
        throw new Error("Unexpected end of expression.");
    }

    private isNextTokenType(types: TokenType[]): boolean {
        return types.indexOf(this.nextTokenType) >= 0;
    }

    private ensureTokenType(types: TokenType[]) {
        if (this.eoe) {
            this.unexpectedEoe();
        }
        else if (!(types.indexOf(this.current.type) >= 0)) {
            this.unexpectedToken();
        }
    }

    private moveNext(expectedTypes?: TokenType[]) {
        this._index++;

        if (expectedTypes) {
            this.ensureTokenType(expectedTypes);    
        }
    }

    private get eoe(): boolean {
        return this._index >= this.tokens.length;
    }

    private get current(): Token {
        return this.tokens[this._index];
    }

    private get nextTokenType(): TokenType {
        if (this._index < this.tokens.length - 1) {
            return this.tokens[this._index + 1].type;
        }
        else {
            return null;
        }
    }

    constructor(readonly tokens: Token[]) {
    }

    private parseFunctionParameters(functionCall: FunctionCallNode) {
        let moreParameters = false;
        let startTokenType = TokenType.OpenParen;

        do {
            functionCall.parameters.push(this.parseExpression(startTokenType, [TokenType.CloseParen, TokenType.Comma]));

            moreParameters = this.current.type == TokenType.Comma;

            if (moreParameters) {
                startTokenType = TokenType.Comma;
            }
        } while (moreParameters);
    }

    private parsePropertyPathOrFunctionCall(): PropertyPathNode | FunctionCallNode {
        let result = new PropertyPathNode();

        let expectedTokenTypes: Array<TokenType> = [TokenType.Identifier];
        let canEndPath = false;
        let canBeFunctionCall = true;

        while (!this.eoe) {
            this.ensureTokenType(expectedTokenTypes);

            switch (this.current.type) {
                case TokenType.Identifier:
                    result.properties.push(this.current.value);

                    expectedTokenTypes = [TokenType.Period, TokenType.OpenSquare];

                    if (canBeFunctionCall) {
                        expectedTokenTypes.push(TokenType.OpenParen);
                    }

                    canEndPath = true;

                    break;
                case TokenType.Period:
                    expectedTokenTypes = [TokenType.Identifier];

                    canEndPath = false;

                    break;
                case TokenType.OpenSquare:
                    result.properties.push(this.parseExpression(TokenType.OpenSquare, [TokenType.CloseSquare]));

                    expectedTokenTypes = [TokenType.Period];

                    canEndPath = true;
                    canBeFunctionCall = false;

                    break;
                case TokenType.OpenParen:
                    let functionCall = new FunctionCallNode();
                    functionCall.functionName = result.properties.join(".");

                    this.parseFunctionParameters(functionCall);
            
                    return functionCall;
                default:
                    this.unexpectedToken();
            }

            if (!this.isNextTokenType(expectedTokenTypes) && canEndPath) {
                return result;
            }

            this.moveNext();
        }

        this.unexpectedToken();
    }

    private parseExpression(startTokenType: TokenType, endTokenTypes: TokenType[]): Expression {
        let result: Expression = new Expression();

        this.ensureTokenType([startTokenType]);
        this.moveNext();

        let expectedNextTokenTypes: Array<TokenType> = literals.concat([ TokenType.Plus, TokenType.Minus ]).concat([TokenType.OpenParen]);

        while (!this.eoe) {
            this.ensureTokenType(expectedNextTokenTypes);

            switch (this.current.type) {
                case TokenType.OpenParen:
                    result.nodes.push(this.parseExpression(TokenType.OpenParen, [TokenType.CloseParen]));

                    expectedNextTokenTypes = orderedOperators.concat(endTokenTypes);

                    break;
                case TokenType.CloseSquare:
                case TokenType.CloseParen:
                case TokenType.CloseCurly:
                case TokenType.Comma:
                    if (result.nodes.length == 0) {
                        this.unexpectedToken();
                    }

                    this.ensureTokenType(endTokenTypes);

                    return result;
                case TokenType.Identifier:
                    result.nodes.push(this.parsePropertyPathOrFunctionCall());

                    expectedNextTokenTypes = orderedOperators.concat(endTokenTypes);

                    break;
                case TokenType.String:
                case TokenType.Number:
                case TokenType.Boolean:
                    if (this.current.type == TokenType.String) {
                        result.nodes.push(new LiteralNode(this.current.value));
                    }
                    else if (this.current.type == TokenType.Number) {
                        result.nodes.push(new LiteralNode(parseFloat(this.current.value)));
                    }
                    else {
                        result.nodes.push(new LiteralNode(this.current.value === "true"));
                    }

                    expectedNextTokenTypes = orderedOperators.concat(endTokenTypes);

                    break;
                case TokenType.Minus:
                    if (result.nodes.length == 0) {
                        result.nodes.push(new LiteralNode(-1));
                        result.nodes.push(new OperatorNode(TokenType.Multiply));

                        expectedNextTokenTypes = [TokenType.Identifier, TokenType.Number, TokenType.OpenParen];

                        break;
                    }
                case TokenType.Plus:
                    if (result.nodes.length == 0) {
                        expectedNextTokenTypes = literals.concat([TokenType.OpenParen]);

                        break;
                    }
                case TokenType.Multiply:
                case TokenType.Divide:
                case TokenType.Equal:
                case TokenType.NotEqual:
                case TokenType.LessThan:
                case TokenType.LessThanOrEqual:
                case TokenType.GreaterThan:
                case TokenType.GreaterThanOrEqual:
                    if (result.nodes.length == 0) {
                        this.unexpectedToken();
                    }

                    result.nodes.push(new OperatorNode(this.current.type));

                    expectedNextTokenTypes = literals.concat([TokenType.OpenParen]);

                    break;
                default:
                    this.unexpectedToken();
            }

            this.moveNext();
        }

        this.unexpectedEoe();
    }

    reset() {
        this._index = 0;
    }

    parse(): Expression {
        this.reset();

        return this.parseExpression(TokenType.OpenCurly, [TokenType.CloseCurly]);
    }
}