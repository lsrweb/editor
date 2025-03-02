console.log('Hello, world!');

class MEditor {
  constructor() {
    console.log('MEditor initialized');
  }

  init(): void {
    console.log('Editor initialized');
  }
}

// 确保正确导出，支持ESM和其他格式
export default MEditor;
