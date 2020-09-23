export interface ICharHandler {
    checkCurrentChar(currentIndex: number, currentBuffer: any[]): boolean;
    handleCurrentChar(currentIndex: number, currentBuffer: any[]): void;
}
