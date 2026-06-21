class CustomError extends Error {
    httpCode: number;
    constructor(message: string, httpCode: number) {
        super(message);
        this.name = "CustomError";
        this.httpCode = httpCode;
    }
}

class NoAutorizadoException extends CustomError {
    constructor(message: string) {
        super(message, 401);
    }
}
class NoExisteException extends CustomError {
    constructor(message: string) {
        super(message, 204);
    }
}
class ParametrosIncompletosException extends CustomError {
    constructor(message: string) {
        super(message, 400);
    }
}
class NoHayUsuarioException extends CustomError {
    constructor(message: string) {
        super(message, 401);
    }
}
class MalaPeticionException extends CustomError {
    constructor(message: string) {
        super(message, 400);
    }
}
class InesperadoException extends CustomError {
    constructor(message: string) {
        super(message, 500);
    }
}

export {
    CustomError,
    NoAutorizadoException,
    NoExisteException,
    ParametrosIncompletosException,
    NoHayUsuarioException,
    MalaPeticionException,
    InesperadoException
}