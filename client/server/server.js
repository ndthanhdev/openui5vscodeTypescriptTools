"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const vscode_languageserver_1 = require("vscode-languageserver");
const filehandler_1 = require("./filehandler");
const Log_1 = require("./Log");
const XmlCompletionProvider_1 = require("./providers/XmlCompletionProvider");
const XmlDiagnosticProvider_1 = require("./providers/XmlDiagnosticProvider");
const XmlHoverProvider_1 = require("./providers/XmlHoverProvider");
const xmltypes_1 = require("./xmltypes");
const controllerFileEx = "\\.controller\\.(js|ts)$";
if (!("toJSON" in Error.prototype))
    Object.defineProperty(Error.prototype, "toJSON", {
        configurable: true,
        value: () => {
            const alt = {};
            Object.getOwnPropertyNames(this).forEach((key) => {
                alt[key] = this[key];
            }, this);
            return alt;
        },
        writable: true,
    });
var Global;
(function (Global) {
})(Global = exports.Global || (exports.Global = {}));
// Create a connection for the server. The connection uses Node's IPC as a transport
const connection = vscode_languageserver_1.createConnection(new vscode_languageserver_1.IPCMessageReader(process), new vscode_languageserver_1.IPCMessageWriter(process));
// Create a simple text document manager. The text document manager
// supports full document sync only
const documents = new vscode_languageserver_1.TextDocuments();
connection.onInitialize((params) => {
    connection.console.info("Initializing XML language server");
    // connection.console.log("params: " + JSON.stringify(params));
    Global.serverSettings = params.initializationOptions;
    Global.workspaceRoot = params.rootPath;
    Global.schemastore = new xmltypes_1.XmlStorage(Global.serverSettings.storagepath, connection, Log_1.LogLevel.None);
    connection.console.info("Starting Listener");
    // Make the text document manager listen on the connection
    // for open, change and close text document events
    documents.listen(connection);
    return {
        capabilities: {
            codeActionProvider: false,
            completionProvider: {
                resolveProvider: false,
                triggerCharacters: ["<", ">", '"', "'", ".", "/"],
            },
            // Tell the client that the server support code complete
            definitionProvider: false,
            hoverProvider: true,
            // Tell the client that the server works in FULL text document sync mode
            textDocumentSync: documents.syncKind,
        },
    };
});
connection.onCompletion((params, token) => __awaiter(this, void 0, void 0, function* () {
    connection.console.info("Completion providing request received");
    // Use completion list, as the return will be called before
    const cl = {
        isIncomplete: true,
        items: [],
    };
    const doc = documents.get(params.textDocument.uri);
    const line = getLine(doc.getText(), params.position.line);
    try {
        const ch = new XmlCompletionProvider_1.XmlCompletionHandler(Global.schemastore, doc, connection, "./schemastore", Global.settings.ui5ts.lang.xml.LogLevel);
        cl.items = cl.items.concat(yield ch.getCompletionSuggestions(params));
        cl.isIncomplete = false;
    }
    catch (error) {
        connection.console.error("Error when getting XML completion entries: " + JSON.stringify(error));
    }
    return cl;
}));
connection.onHover((params, token) => __awaiter(this, void 0, void 0, function* () {
    connection.console.info("Hover request received");
    const doc = documents.get(params.textDocument.uri);
    const line = getLine(doc.getText(), params.position.line);
    try {
        const ch = new XmlHoverProvider_1.XmlHoverProvider(Global.schemastore, documents, connection, "./schemastore", Global.settings.ui5ts.lang.xml.LogLevel);
        return yield ch.getHoverInformation(params);
    }
    catch (error) {
        connection.console.error("Error when getting XML completion entries: " + JSON.stringify(error));
    }
    return undefined;
}));
documents.onDidChangeContent((params) => __awaiter(this, void 0, void 0, function* () {
    const doc = documents.get(params.document.uri);
    if (!doc)
        return;
    const diagnostics = { uri: doc.uri, diagnostics: [] };
    try {
        const wfd = new XmlDiagnosticProvider_1.XmlWellFormedDiagnosticProvider(connection, Global.settings.ui5ts.lang.xml.LogLevel);
        diagnostics.diagnostics = diagnostics.diagnostics.concat(yield wfd.diagnose(doc));
    }
    catch (error) {
    }
    try {
        const ad = new XmlDiagnosticProvider_1.XmlAttributeDiagnosticProvider(Global.schemastore, connection, Global.settings.ui5ts.lang.xml.LogLevel);
        diagnostics.diagnostics = diagnostics.diagnostics.concat(yield ad.diagnose(doc));
    }
    catch (error) {
    }
    connection.sendDiagnostics(diagnostics);
}));
connection.onDidChangeConfiguration((change) => {
    connection.console.info("Changed settings: " + JSON.stringify(change));
    Global.settings = change.settings;
    if (!change.settings.ui5ts.lang || !change.settings.ui5ts.lang.xml) {
        Global.settings.ui5ts.lang = {
            xml: {
                LogLevel: 4,
                autoCloseEmptyElement: false,
            }
        };
    }
});
function getLine(text, linenumber) {
    const lines = text.split(/\n/);
    if (linenumber > lines.length - 1)
        linenumber = lines.length - 1;
    return lines[linenumber];
}
exports.getLine = getLine;
function getRange(docText, searchPattern) {
    const lineRegex = /.*(?:\n|\r\n)/gm;
    let l;
    const ret = [];
    let linectr = 0;
    while ((l = lineRegex.exec(docText)) !== null) {
        linectr = linectr + 1;
        if (l.index === lineRegex.lastIndex)
            lineRegex.lastIndex++;
        const match = searchPattern.exec(l);
        if (!match)
            continue;
        ret.push({ start: { line: linectr, character: match.index }, end: { line: linectr, character: match.index + match[0].length } });
    }
    return ret;
}
exports.getRange = getRange;
function getPositionFromIndex(input, index) {
    const lines = input.split("\n");
    let curindex = 0;
    let lineindex = 0;
    for (const line of lines) {
        if (index <= curindex + line.length) {
            return {
                character: index - curindex,
                line: lineindex,
            };
        }
        curindex += line.length + 1;
        lineindex++;
    }
}
exports.getPositionFromIndex = getPositionFromIndex;
function getLineCount(input) {
    return input.split("\n").length;
}
exports.getLineCount = getLineCount;
function tryOpenEventHandler(line, positionInLine, documentText) {
    const rightpart = line.substr(positionInLine).match(/(\w*?)"/)[1];
    if (!rightpart)
        return null;
    let leftpart = line.substr(0, positionInLine);
    const leftquotepos = leftpart.match(/.*"/)[0].length;
    if (!leftquotepos)
        return;
    leftpart = leftpart.substr(leftquotepos);
    const name = leftpart + rightpart;
    const cnameri = documentText.match(/controllerName="([\w\.]+)"/);
    if (!cnameri) {
        return [];
    }
    const cname = cnameri[1].split(".").pop();
    const files = filehandler_1.File.find(new RegExp(cname + controllerFileEx));
    const foundControllers = [];
    const ret = [];
    // Check typescript (dirty)
    for (let i = 0; i < files.length; i = i + 2) {
        const f = files.length > 1 ? files[i + 1] : files[i];
        foundControllers.push({ range: { start: { character: 0, line: 0 }, end: { character: 0, line: 0 } }, uri: "file:///" + f });
    }
    // TODO: Make more robust regex for finding method
    for (const entry of foundControllers) {
        const txt = filehandler_1.File.open(entry.uri.substr(8));
        const matchRegex = new RegExp(name + /\s*?\(.*?\)/.source, "g");
        const ranges = getRange(txt, matchRegex);
        if (ranges.length > 0)
            for (const r of ranges)
                ret.push({ uri: entry.uri, range: r });
    }
    return ret;
}
connection.listen();
//# sourceMappingURL=server.js.map