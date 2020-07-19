import { ElementRef, EventEmitter, Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { Subject } from 'rxjs';
import { DefaultEditorOptions, EditorOptions } from './editor.options';

export enum EventType {
  KeyUp = 'keyup',
  KeyDown = 'keydown',
  KeyPressed = 'keypressed',
  MouseDown = 'mousedown',
  MouseUp = 'mouseup',
  Click = 'click',
  Input = 'input',
  Copy = 'copy',
  Paste = 'paste',
  Cut = 'cut'
}

@Injectable({
  providedIn: 'root'
})
export class NeutrinoService {
  private eventsCallbacks: Map<ElementRef, Map<string, ((event: Event) => void)[]>> = new Map<
    ElementRef,
    Map<string, ((event: Event) => void)[]>
  >();
  private eventsCallbacksToExecLast: Map<ElementRef, Map<string, ((event: Event) => void)[]>> = new Map<
    ElementRef,
    Map<string, ((event: Event) => void)[]>
  >();
  private valueChangedSubjects: Map<ElementRef, Subject<string>> = new Map<ElementRef, Subject<string>>();
  private editorsOptions: Map<ElementRef, EditorOptions> = new Map<ElementRef, EditorOptions>();
  private renderer: Renderer2;
  private currentLine = 0;
  private anchorIndex = 0;
  private focusIndex = 0;

  constructor(private rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  public setEditorOptions(editor: ElementRef, options: EditorOptions) {
    this.editorsOptions.set(editor, options);
  }

  public getValueChangedListener(editor: ElementRef) {
    if (!this.valueChangedSubjects.has(editor)) {
      this.valueChangedSubjects.set(editor, new Subject<string>());
    }

    return this.valueChangedSubjects.get(editor).asObservable();
  }

  public addEventHandler(
    editor: ElementRef,
    eventType: EventType,
    callback: (event: Event) => void,
    executeAfterRender?: boolean
  ): void {
    if (
      (executeAfterRender && this.eventsCallbacksToExecLast.get(editor)) ||
      (!executeAfterRender && this.eventsCallbacks.get(editor))
    ) {
      const eventHandlers = executeAfterRender ?
        this.eventsCallbacksToExecLast.get(editor) :
        this.eventsCallbacks.get(editor);
      const callbacks = eventHandlers.get(eventType);

      if (callbacks) {
        callbacks.push(callback);
      } else {
        eventHandlers.set(eventType, [callback]);
      }
    } else {
      const eventHandlers = new Map<string, ((event: Event) => void)[]>();
      eventHandlers.set(eventType, [callback]);

      if (executeAfterRender) {
        this.eventsCallbacksToExecLast.set(editor, eventHandlers);
      } else {
        this.eventsCallbacks.set(editor, eventHandlers);
      }
    }
  }

  public handleEvent(editor: ElementRef, event: Event): void {
    let eventHandlers = this.eventsCallbacks.get(editor);
    this.executeEvents(event, eventHandlers);
    this.refreshEditorState(editor);

    if (
      event instanceof KeyboardEvent &&
      this.checkKeyToRender(event as KeyboardEvent)
    ) {
      this.render(editor);
      this.restoreSelection(editor);

      if (event.type === 'keyup') {
        this.valueChangedSubjects.get(editor).next(this.getEditorText(editor));
      }
    }

    eventHandlers = this.eventsCallbacksToExecLast.get(editor);
    this.executeEvents(event, eventHandlers);
  }

  private executeEvents(event: Event, eventHandlers: Map<string, ((event: Event) => void)[]>) {
    if (eventHandlers) {
      const callBacks = eventHandlers.get(event.type);

      if (callBacks) {
        callBacks.forEach((callback) => {
          callback(event);
        });
      }
    }
  }

  public getTextSegments(element: Node, downOneLevel: boolean): { text: string; node: Node }[] {
    const textSegments: { text: string; node: Node }[] = [];

    if (element) {
      Array.from(element.childNodes).forEach((node) => {
        switch (node.nodeType) {
          case Node.TEXT_NODE:
            textSegments.push({ text: node.textContent, node });
            break;

          case Node.ELEMENT_NODE:
            if (downOneLevel) {
              textSegments.push({ text: node.textContent, node });
            } else {
              textSegments.splice(textSegments.length, 0, ...this.getTextSegments(node, downOneLevel));
            }
            break;

          default:
            throw new Error(`Unexpected node type: ${node.nodeType}`);
        }
      });
    }

    return textSegments;
  }

  public getEditorText(editor: ElementRef): string {
    const lines: string[] = [];

    this.getTextSegments(editor.nativeElement, true)
    .forEach((line, index) => {
      lines.push(line.text);
    });

    return lines.join('\n');
  }

  public getClosestViewLine(editor: ElementRef): HTMLDivElement {
    const sel = document.getSelection();
    return this.getParentLine(editor, sel.focusNode as HTMLElement);
  }

  public getParentLine(editor: ElementRef, child: HTMLElement): HTMLDivElement {
    let anchorLine: HTMLElement = child;

    while (
      (!anchorLine.classList || !anchorLine.classList.contains('view-line')) &&
      !anchorLine.isSameNode(editor.nativeElement)
    ) {
      anchorLine = anchorLine.parentElement;
    }

    if (child.isSameNode(editor.nativeElement)) {
      anchorLine = null;
    }

    return anchorLine as HTMLDivElement;
  }

  public render(editor: ElementRef, value?: string): void {
    const editorNative = editor.nativeElement as HTMLSpanElement;
    let editorText;

    if (value) {
      editorText = Array.from(value);
    } else {
      const textSegments = this.getTextSegments(editorNative, true);
      editorText = Array.from(
        textSegments
        .map(segment => segment.text)
        .join('\n')
      );
    }

    editorText.push('\n');
    editorNative.innerHTML = '';

    const editorTextLength = editorText.length;
    let lineNumber = 1;
    let line = this.appendLine(editor, lineNumber);
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
          line = this.appendLine(editor, lineNumber);
        }
      } else if (char === '\t') {
        if (currentText !== '') {
          this.appendText(line, currentText);
        }

        this.appendTab(editor, line);
        currentText = '';
      } else {
        currentText += char;
      }
    });
  }

  private checkKeyToRender(event: KeyboardEvent): boolean {
    return  event                      &&
            event.key !== 'ArrowUp'    &&
            event.key !== 'ArrowRight' &&
            event.key !== 'ArrowDown'  &&
            event.key !== 'ArrowLeft'  &&
            event.key !== 'Shift'      &&
            event.key !== 'Control'    &&
            event.key !== 'Alt'        &&
            event.key !== 'End'        &&
            event.key !== 'Home';
  }

  private appendLine(editor: ElementRef, lineNumber?: number): HTMLDivElement {
    const line: HTMLDivElement = this.renderer.createElement('div');
    const br: HTMLBRElement = this.renderer.createElement('br');

    if (lineNumber) {
      line.id = `line-${lineNumber}`;
    }

    this.renderer.addClass(line, 'view-line');
    this.renderer.appendChild(line, br);
    this.renderer.appendChild(editor.nativeElement, line);

    return line;
  }

  private appendTab(editor: ElementRef, line: HTMLDivElement) {
    let editorOptions = this.editorsOptions.get(editor);

    if (!editorOptions) {
      editorOptions = new DefaultEditorOptions();
    }

    for (let i = 0; i < editorOptions.tabSpaces; i++) {
      this.renderer.appendChild(line, this.renderer.createText('\u00a0'));
    }
  }

  private appendText(line: HTMLDivElement, text: string): void {
    const textNode = this.renderer.createText(text);
    this.renderer.appendChild(line, textNode);
  }

  private restoreSelection(editor: ElementRef): void {
    const sel: Selection = window.getSelection();
    const lines: NodeList = editor.nativeElement.querySelectorAll('.view-line');
    const line: Node = lines[this.currentLine];
    const textSegments = this.getTextSegments(line, false);

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
        editor,
        this.getParentLine(editor, focusNode as HTMLElement) as HTMLDivElement
      );
    }

    sel.setBaseAndExtent(anchorNode, anchorIndex, focusNode, focusIndex);
  }

  private focusLine(editor: ElementRef, line: HTMLDivElement) {
    const lines = editor.nativeElement.querySelectorAll('.view-line');

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

  private refreshEditorState(editor: ElementRef) {
    const sel: Selection = document.getSelection();
    const line: HTMLDivElement = this.getClosestViewLine(editor);

    if (line) {
      this.refreshCurrentLine(editor, line);
      let currentIndex = 0;
      const textSegments = this.getTextSegments(line, false);

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

  private refreshCurrentLine(editor: ElementRef, lineElement: Node): void {
    const lines: NodeList = editor.nativeElement.querySelectorAll('.view-line');
    const linesCount = lines.length;

    for (let i = 0; i < linesCount; i++) {
      this.currentLine = i;

      if (lines[i] === lineElement) {
        break;
      }
    }
  }
}
