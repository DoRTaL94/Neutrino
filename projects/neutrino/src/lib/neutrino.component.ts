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

  private tab = '';
  private currentLine = 0;
  private anchorIndex = 0;
  private focusIndex = 0;

  constructor(
    private neutrinoService: NeutrinoService,
    private renderer: Renderer2
  ) {
  }

  ngOnInit(): void {
    this.initTab();
  }

  onKeyDown(event: KeyboardEvent): void {
    this.handleDeletion(event);
    this.handleInsertTab(event);
    this.handleAutoComplete(event);
  }

  onKeyUp(event: KeyboardEvent): void {
    this.refreshEditorState();

    if (
      event.key !== 'ArrowUp' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'ArrowDown' &&
      event.key !== 'ArrowLeft' &&
      event.key !== 'Shift' &&
      event.key !== 'Control' &&
      event.key !== 'Alt' &&
      event.key !== 'End' &&
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
    let line = this.appendLine();
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
          line = this.appendLine();
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

  private appendLine(): HTMLDivElement {
    const line = this.renderer.createElement('div');
    const br = this.renderer.createElement('br');

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

        if (line.textContent === this.tab) {
          this.focusIndex++;
          this.anchorIndex++;
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

  private initTab(): void {
    for (let i = 0; i < this.tabSpaces; i++) {
      this.tab += '\u00a0';
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
      const tab = this.renderer.createText(this.tab);

      sel.deleteFromDocument();
      range.insertNode(tab);
      range.setStartAfter(tab);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);

      event.preventDefault();
    }
  }

  private appendTab(line: HTMLDivElement) {
    this.renderer.appendChild(line, this.renderer.createText(this.tab));
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
