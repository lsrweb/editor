class MEditor extends HTMLElement {
  // 添加一个静态标志，用于识别是否通过工厂方法创建
  static isCreatingViaFactory = false;

  constructor() {
    super();
    
    // 检查是否是通过new操作符直接实例化的，且不是通过工厂方法
    if (new.target === MEditor && !MEditor.isCreatingViaFactory) {
      return MEditor.createInstance();
    }
  }
  
  // 静态工厂方法，用于处理通过new创建的情况
  static createInstance() {
    try {
      // 设置标志，防止递归调用
      MEditor.isCreatingViaFactory = true;
      
      // 创建自定义元素
      const element = document.createElement('m-editor');
      
      return element;
    } finally {
      // 无论成功失败都重置标志
      MEditor.isCreatingViaFactory = false;
    }
  }

  // 这里添加其他MEditor的方法和属性...
}

// 确保自定义元素已注册
if (!customElements.get('m-editor')) {
  customElements.define('m-editor', MEditor);
}

export default MEditor;
