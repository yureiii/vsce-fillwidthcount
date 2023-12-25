"use strict";
import {
  window,
  workspace,
  Disposable,
  ExtensionContext,
  StatusBarAlignment,
  StatusBarItem,
  TextDocument,
} from "vscode";
export function activate(context: ExtensionContext) {
  let characterCounter = new CharacterCounter();
  let controller = new CharacterCounterController(characterCounter);
  context.subscriptions.push(controller);
  context.subscriptions.push(characterCounter);
}

export class CharacterCounter {
  private _statusBarItem!: StatusBarItem;
  // カウントに含めない文字を削除する
  // gm の replace は \s 削除より先
  // 半角文字削除は最後
  private _deleteRegexsInfo = [
    { regex: /^\s*#.*$/gm, optionName: "heading" }, // 見出し
    { regex: /\s/g, optionName: "whitespace" }, // すべての空白文字
    { regex: /<!--[\s\S]*?-->/g, optionName: "htmlComment" }, // コメントアウトした文字
    { regex: /《[\s\S]*?》/g, optionName: "aozoraRuby" }, // ルビ範囲指定記号とその中の文字
    { regex: /<rt>[\s\S]*?<\/rt>/g, optionName: "htmlRuby" }, // ルビ範囲指定記号とその中の文字 <ruby> は数える
    { regex: /[\|｜]/g, optionName: "verticalBarRuby" }, // ルビ開始記号
    { regex: /[\x00-\x7F]/g, optionName: "asciiCharacters" }, // 半角文字 (ASCII)
  ];
  private _deleteRegexs; // オプションに変更があると _deleteRegex の要素を増減させる

  constructor() {
    this._deleteRegexs = this._deleteRegexsInfo.map((item) => item.regex);
    // オプションで数える種類を変更する
    // 頻繁には呼ばれないはずなので処理の速さは気にしない
    workspace.onDidChangeConfiguration((_) => this.updateDeleteRegexs());
  }

  public updateDeleteRegexs() {
    this._deleteRegexs = this._deleteRegexsInfo
      .filter(
        ({ optionName }) =>
          workspace
            .getConfiguration()
            .get("vsce-fullwidthcount." + optionName) == false
      )
      .map((regexInfo) => regexInfo.regex);
  }

  public updateCharacterCount() {
    if (!this._statusBarItem) {
      this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
    }
    let editor = window.activeTextEditor;
    if (!editor) {
      this._statusBarItem.hide();
      return;
    }
    let doc = editor.document;

    // Markdownとプレーンテキストの時だけカウント
    if (doc.languageId === "markdown" || doc.languageId === "plaintext") {
      let characterCount = this._getCharacterCount(doc);
      this._statusBarItem.text = `$(pencil) ${characterCount} 文字`;
      this._statusBarItem.show();
    } else {
      this._statusBarItem.hide();
    }
  }

  public _getCharacterCount(doc: TextDocument): number {
    let docContent = doc.getText();
    this._deleteRegexs.forEach(
      (regex) => (docContent = docContent.replace(regex, ""))
    );
    let characterCount = 0;
    if (docContent !== "") {
      characterCount = docContent.length;
    }
    return characterCount;
  }

  public dispose() {
    this._statusBarItem.dispose();
  }
}

class CharacterCounterController {
  private _characterCounter: CharacterCounter;
  private _disposable: Disposable;

  constructor(characterCounter: CharacterCounter) {
    this._characterCounter = characterCounter;
    this._characterCounter.updateCharacterCount();

    let subscriptions: Disposable[] = [];
    window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
    window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);

    this._disposable = Disposable.from(...subscriptions);
  }

  private _onEvent() {
    this._characterCounter.updateCharacterCount();
  }

  public dispose() {
    this._disposable.dispose();
  }
}
