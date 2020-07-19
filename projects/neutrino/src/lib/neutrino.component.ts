import { Component, ElementRef, Input, OnInit, Renderer2, ViewChild } from '@angular/core';
import { NeutrinoService } from './neutrino.service';

@Component({
  selector: 'nt-editor',
  templateUrl: './neutrino.component.html',
  styleUrls: ['./neutrino.component.css']
})
export class NeutrinoComponent implements OnInit {
  @ViewChild('editor', { read: ElementRef })
  editor: ElementRef;

  @Input()
  public tabSpaces = 2;

  private currentLine = 0;
  private anchorIndex = 0;
  private focusIndex = 0;

  constructor(
    private neutrinoService: NeutrinoService,
    private renderer: Renderer2
  ) {
  }

  ngOnInit(): void {
  }

  onKeyDown(event: KeyboardEvent): void {
    this.handleDeletion(event);
    this.handleInsertTab(event);
    this.handleAutoComplete(event);
  }

  onKeyUp(event: KeyboardEvent): void {
    this.refreshEditorState();

    if (
      event.key !== 'ArrowUp'    &&
      event.key !== 'ArrowRight' &&
      event.key !== 'ArrowDown'  &&
      event.key !== 'ArrowLeft'  &&
      event.key !== 'Shift'      &&
      event.key !== 'Control'    &&
      event.key !== 'Alt'        &&
      event.key !== 'End'        &&
      event.key !== 'Home'
    ) {
      this.render();
      this.restoreSelection();
    }
  }

  onMouseClick(event: MouseEvent): void {

  }

  private render(): void {
    const editor = this.editor.nativeElement as HTMLSpanElement;
    const textSegments = this.neutrinoService.getTextSegments(editor, true);
    const editorText = Array.from(
      textSegments
      .map(segment => segment.text)
      .join('\n')
    );

    editorText.push('\n');
    editor.innerHTML = '';

    const editorTextLength = editorText.length;
    let lineNumber = 1;
    let line = this.appendLine(lineNumber);
    let currentText = '';

    editorText.forEach((char, index) => {
      if (char === '\n') {
        if (currentText !== '') {
          // line is empty so we want to remove the <br> inside.
          if (line.textContent === '') {
            line.innerHTML = '';
          }

          this.appendText(line, currentText);
          currentText = '';
        }

        if (index < editorTextLength - 1) {
          lineNumber++;
          line = this.appendLine(lineNumber);
        }
      } else if (char === '\t') {
        if (currentText !== '') {
          this.appendText(line, currentText);
        }

        this.appendTab(line);
        currentText = '';
      } else {
        currentText += char;
      }
    });
  }

  private appendLine(lineNumber?: number): HTMLDivElement {
    const line: HTMLDivElement = this.renderer.createElement('div');
    const br: HTMLBRElement = this.renderer.createElement('br');

    if (lineNumber) {
      line.id = `line-${lineNumber}`;
    }

    this.renderer.addClass(line, 'view-line');
    this.renderer.appendChild(line, br);
    this.renderer.appendChild(this.editor.nativeElement, line);

    return line;
  }

  private handleAutoComplete(event: KeyboardEvent): void {
    let opening: Text;
    let closure: Text;

    if (event.key === '{') {
      opening = this.renderer.createText('{');
      closure = this.renderer.createText('}');
    } else if (event.key === '[') {
      opening = this.renderer.createText('[');
      closure = this.renderer.createText(']');
    } else if (event.key === '(') {
      opening = this.renderer.createText('(');
      closure = this.renderer.createText(')');
    }

    if (opening) {
      const sel = document.getSelection();
      const range = sel.getRangeAt(0);

      range.insertNode(closure);
      range.insertNode(opening);
      range.setStartBefore(closure);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      event.preventDefault();
    }
  }

  private refreshEditorState() {
    const sel: Selection = document.getSelection();
    const line: HTMLDivElement = this.neutrinoService.getClosestViewLine(this.editor);

    if (line) {
      this.refreshCurrentLine(line);
      let currentIndex = 0;
      const textSegments = this.neutrinoService.getTextSegments(line, false);

      textSegments.forEach(({ text, node }) => {
        if (node === sel.anchorNode) {
          this.anchorIndex = currentIndex + sel.anchorOffset;
        } else if (node.parentElement === sel.anchorNode) {
          const range = new Range();
          range.selectNode(node);
          this.anchorIndex = currentIndex + sel.anchorOffset - range.startOffset;
        }

        if (node === sel.focusNode) {
          this.focusIndex = currentIndex + sel.focusOffset;
        } else if (node.parentElement === sel.focusNode) {
          const range = new Range();
          range.selectNode(node);
          this.focusIndex = currentIndex + sel.focusOffset - range.startOffset;
        }

        currentIndex += text.length;
      });
    }
  }

  private refreshCurrentLine(lineElement: Node): void {
    const lines: NodeList = this.editor.nativeElement.querySelectorAll('.view-line');
    const linesCount = lines.length;

    for (let i = 0; i < linesCount; i++) {
      this.currentLine = i;

      if (lines[i] === lineElement) {
        break;
      }
    }
  }

  private handleDeletion(event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      const line = this.neutrinoService.getClosestViewLine(this.editor);
      const emptyLine = line.textContent === '';
      const oneLine = this.editor.nativeElement.querySelectorAll('.view-line').length === 1;

      if (emptyLine && oneLine) {
        event.preventDefault();
        return;
      }
    }
  }

  private handleInsertTab(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      const sel = document.getSelection();
      const range = sel.getRangeAt(0);
      const anchorLine: HTMLDivElement = this.neutrinoService
        .getParentLine(this.editor, sel.anchorNode as HTMLElement);
      const focusLine: HTMLDivElement = this.neutrinoService
        .getParentLine(this.editor, sel.focusNode as HTMLElement);

      // In case user selected text and pressed 'Tab', the text should be deleted and be replaced with a tab
      range.extractContents();

      // Multiline selection
      if (!anchorLine.isSameNode(focusLine)) {
        // extractContents function doesn't remove anchor line if it's empty after extraction
        if (anchorLine.textContent === '') {
          anchorLine.remove();
        }

        range.setStartAfter(focusLine.lastChild);
        range.collapse(true);
      }

      for (let i = 0 ; i < this.tabSpaces; i++) {
        const nonBreakingSpace = this.renderer.createText('\u00a0');
        range.insertNode(nonBreakingSpace);
        range.setStartAfter(nonBreakingSpace);
        range.collapse(true);
      }

      sel.removeAllRanges();
      sel.addRange(range);

      event.preventDefault();
    }
  }

  private appendTab(line: HTMLDivElement) {
    for (let i = 0; i < this.tabSpaces; i++) {
      this.renderer.appendChild(line, this.renderer.createText('\u00a0'));
    }
  }

  private appendText(line: HTMLDivElement, text: string): void {
    const textNode = this.renderer.createText(text);
    this.renderer.appendChild(line, textNode);
  }

  private restoreSelection(): void {
    const sel: Selection = window.getSelection();
    const lines: NodeList = this.editor.nativeElement.querySelectorAll('.view-line');
    const line: Node = lines[this.currentLine];
    const textSegments = this.neutrinoService.getTextSegments(line, false);

    let anchorNode = line;
    let anchorIndex = 0;
    let focusNode = line;
    let focusIndex = 0;
    let currentIndex = 0;

    textSegments.forEach(({ text, node }) => {
      const startIndexOfNode = currentIndex;
      const endIndexOfNode = startIndexOfNode + text.length;

      if (startIndexOfNode <= this.anchorIndex && this.anchorIndex <= endIndexOfNode) {
        anchorNode = node;
        anchorIndex = this.anchorIndex - startIndexOfNode;
      }

      if (startIndexOfNode <= this.focusIndex && this.focusIndex <= endIndexOfNode) {
        focusNode = node;
        focusIndex = this.focusIndex - startIndexOfNode;
      }

      currentIndex += text.length;
    });

    if (focusNode) {
      this.focusLine(
        this.neutrinoService
        .getParentLine(this.editor, focusNode as HTMLElement) as HTMLDivElement
      );
    }

    sel.setBaseAndExtent(anchorNode, anchorIndex, focusNode, focusIndex);
  }

  private focusLine(line: HTMLDivElement) {
    const lines = this.editor.nativeElement.querySelectorAll('.view-line');

    if (line) {
      let currentLineSet = false;
      this.currentLine = 0;

      lines.forEach((currLine) => {
        if (currLine === line) {
          currentLineSet = true;
          this.renderer.addClass(currLine, 'focus');
        } else {
          this.renderer.removeClass(currLine, 'focus');
        }

        if (!currentLineSet) {
          this.currentLine++;
        }
      });
    }
  }
}
