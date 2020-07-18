import { ElementRef, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NeutrinoService {

  constructor() { }

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
}
