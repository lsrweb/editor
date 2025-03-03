class MEditor extends HTMLElement {
  static instance = null;

  constructor() {
    super();
    if (MEditor.instance) {
      return MEditor.instance;
    }
    MEditor.instance = this;

    this.attachShadow({ mode: 'open' });
    this.componentPrefixes = ['TLJ-PLLJ-']; // 默认前缀
    this.componentStyles = {
      default: { fontStyle: 'italic' }
    }; // 组件样式配置
    this.observers = []; // 用于数据绑定
    this.init();
  }

  init() {
    // 创建编辑器DOM结构
    this.createEditorDOM();
    // 绑定事件处理
    this.bindEvents();
    // 通知就绪
    this.dispatchEvent(new CustomEvent('editor-ready', { detail: this }));
  }

  createEditorDOM() {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        font-family: Arial, sans-serif;
      }
      .editor-container {
        border: 1px solid #ccc;
        min-height: 200px;
        padding: 10px;
        overflow: auto;
      }
      .editor-content {
        outline: none;
        width: 100%;
        min-height: 180px;
      }
      .component {
        font-style: italic;
        display: inline-block;
        user-select: all;
      }
    `;

    const container = document.createElement('div');
    container.className = 'editor-container';

    const content = document.createElement('div');
    content.className = 'editor-content';
    content.contentEditable = 'true';
    content.setAttribute('data-placeholder', '请输入内容...');

    container.appendChild(content);

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(container);

    this.editorContent = content;
  }

  bindEvents() {
    const boundHandleInput = this.handleInput.bind(this);
    const boundHandleKeydown = this.handleKeydown.bind(this);
    const boundHandlePaste = this.handlePaste.bind(this);
    const boundHandleBeforeInput = this.handleBeforeInput.bind(this);
    const boundHandleFocus = this.handleFocus.bind(this);
    const boundHandleBlur = this.handleBlur.bind(this);
    const boundHandleSelect = this.handleSelect.bind(this);
    const boundHandleClick = this.handleClick.bind(this);

    // 保存绑定的方法引用，以便之后移除事件监听器
    this._boundEvents = {
      input: boundHandleInput,
      keydown: boundHandleKeydown,
      paste: boundHandlePaste,
      beforeinput: boundHandleBeforeInput,
      focus: boundHandleFocus,
      blur: boundHandleBlur,
      select: boundHandleSelect,
      click: boundHandleClick
    };

    // 监听键盘、鼠标等事件
    this.editorContent.addEventListener('input', boundHandleInput);
    this.editorContent.addEventListener('keydown', boundHandleKeydown);
    this.editorContent.addEventListener('paste', boundHandlePaste);
    this.editorContent.addEventListener('beforeinput', boundHandleBeforeInput);

    // 监听编辑器焦点
    this.editorContent.addEventListener('focus', boundHandleFocus);
    this.editorContent.addEventListener('blur', boundHandleBlur);

    // 自定义选择和删除处理
    this.editorContent.addEventListener('select', boundHandleSelect);
    this.editorContent.addEventListener('click', boundHandleClick);
  }

  // 处理输入事件
  handleInput(e) {
    this.notifyContentChange();
  }

  // 处理键盘事件
  handleKeydown(e) {
    // 特殊处理小组件的删除
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const component = this.findComponentNode(range.startContainer);

        if (component) {
          e.preventDefault();
          component.parentNode.removeChild(component);
          this.notifyContentChange();
        }
      }
    }
  }

  // 处理粘贴事件
  handlePaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const cleanText = this.sanitizeText(text);
    document.execCommand('insertText', false, cleanText);
  }

  // 处理beforeinput事件
  handleBeforeInput(e) {
    // 在这里可以拦截和修改输入
  }

  // 处理焦点事件
  handleFocus(e) {
    // 编辑器获取焦点时的处理
  }

  // 处理失焦事件
  handleBlur(e) {
    // 编辑器失去焦点时的处理
  }

  // 处理选择事件
  handleSelect(e) {
    // 处理选择行为
  }

  // 处理点击事件
  handleClick(e) {
    // 处理点击行为，特别是当点击到组件时
    const component = this.findComponentNode(e.target);
    if (component) {
      // 如果点击的是组件，选中整个组件
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNode(component);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  // 查找组件节点
  findComponentNode(node) {
    while (node && node !== this.editorContent) {
      if (node.classList && node.classList.contains('component')) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  // 净化文本，防止XSS攻击
  sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 插入组件
  insertComponent(componentId, componentText = '') {
    
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const componentNode = document.createElement('span');
    componentNode.className = 'component';

    // 添加组件标识
    const prefix = this.componentPrefixes[0]; // 使用默认前缀
    const fullId = `{${prefix}${componentId}}`;
    componentNode.textContent = componentText || fullId;
    componentNode.dataset.componentId = componentId;
    componentNode.dataset.componentPrefix = prefix;

    // 应用默认样式
    this.applyComponentStyle(componentNode);

    // 插入节点
    range.deleteContents();
    range.insertNode(componentNode);

    // 将光标移到组件后面
    const newRange = document.createRange();
    newRange.setStartAfter(componentNode);
    newRange.setEndAfter(componentNode);
    selection.removeAllRanges();
    selection.addRange(newRange);

    this.notifyContentChange();
  }

  // 应用组件样式
  applyComponentStyle(componentNode, styleName = 'default') {
    const style = this.componentStyles[styleName] || this.componentStyles.default;
    Object.entries(style).forEach(([prop, value]) => {
      componentNode.style[prop] = value;
    });
  }

  // 设置组件样式
  setComponentStyle(styleName, styleObject) {
    this.componentStyles[styleName] = styleObject;
    // 更新已有组件的样式
    if (styleName === 'default') {
      const components = this.editorContent.querySelectorAll('.component');
      components.forEach(component => {
        this.applyComponentStyle(component);
      });
    }
  }

  // 添加组件前缀
  addComponentPrefix(prefix) {
    if (!this.componentPrefixes.includes(prefix)) {
      this.componentPrefixes.push(prefix);
    }
  }

  // 移除组件前缀
  removeComponentPrefix(prefix) {
    const index = this.componentPrefixes.indexOf(prefix);
    if (index > -1) {
      this.componentPrefixes.splice(index, 1);
    }
  }

  // 判断是否是组件标记
  isComponentMark(text) {
    return this.componentPrefixes.some(prefix =>
      text.startsWith(`{${prefix}`) && text.endsWith('}')
    );
  }

  // 从文本中提取组件ID
  extractComponentId(text) {
    for (const prefix of this.componentPrefixes) {
      if (text.startsWith(`{${prefix}`) && text.endsWith('}')) {
        return text.substring(prefix.length + 1, text.length - 1);
      }
    }
    return null;
  }

  // 设置内容和组件（回显）
  setContentWithComponents(contentString) {
    // 清空当前内容
    this.clearContent();

    if (!contentString) return;

    let currentIndex = 0;
    let remainingText = contentString;

    while (currentIndex < contentString.length) {
      // 查找下一个可能的组件开始位置
      const nextComponentStartIndex = remainingText.indexOf('{');

      if (nextComponentStartIndex === -1) {
        // 没有更多组件，添加剩余文本
        this.appendTextNode(remainingText);
        break;
      }

      // 添加组件前的文本
      if (nextComponentStartIndex > 0) {
        this.appendTextNode(remainingText.substring(0, nextComponentStartIndex));
      }

      // 查找组件结束位置
      const possibleEndIndex = remainingText.indexOf('}', nextComponentStartIndex);
      if (possibleEndIndex === -1) {
        // 没有找到结束括号，当作普通文本处理
        this.appendTextNode(remainingText.substring(nextComponentStartIndex));
        break;
      }

      // 提取可能的组件文本
      const possibleComponent = remainingText.substring(nextComponentStartIndex, possibleEndIndex + 1);

      // 检查是否真的是组件
      if (this.isComponentMark(possibleComponent)) {
        // 是组件，创建组件节点
        const componentNode = document.createElement('span');
        componentNode.className = 'component';
        componentNode.textContent = possibleComponent;

        // 尝试提取组件ID和前缀
        for (const prefix of this.componentPrefixes) {
          if (possibleComponent.startsWith(`{${prefix}`)) {
            const componentId = possibleComponent.substring(prefix.length + 1, possibleComponent.length - 1);
            componentNode.dataset.componentId = componentId;
            componentNode.dataset.componentPrefix = prefix;
            break;
          }
        }

        // 应用组件样式
        this.applyComponentStyle(componentNode);

        // 添加组件节点到编辑器
        this.editorContent.appendChild(componentNode);
      } else {
        // 不是组件，添加为普通文本
        this.appendTextNode(possibleComponent);
      }

      // 更新剩余文本
      remainingText = remainingText.substring(possibleEndIndex + 1);
      currentIndex = contentString.length - remainingText.length;
    }

    this.notifyContentChange();
  }

  // 添加文本节点
  appendTextNode(text) {
    if (!text) return;
    const textNode = document.createTextNode(text);
    this.editorContent.appendChild(textNode);
  }

  // 清除编辑器内容
  clearContent() {
    this.editorContent.innerHTML = '';
  }

  // 获取当前内容，包括组件
  getContent() {
    return this.editorContent.innerHTML;
  }

  // 获取纯文本内容，将组件替换为其标记
  getPlainContent() {
    let content = '';
    const childNodes = this.editorContent.childNodes;

    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i];
      if (node.nodeType === Node.TEXT_NODE) {
        content += node.textContent;
      } else if (node.classList && node.classList.contains('component')) {
        content += node.textContent;
      } else {
        content += node.textContent;
      }
    }

    return content;
  }

  // 观察数据变化（双向绑定）
  observeContent(callback) {
    if (typeof callback === 'function' && !this.observers.includes(callback)) {
      this.observers.push(callback);
    }
    return this;
  }

  // 移除观察者
  unobserveContent(callback) {
    const index = this.observers.indexOf(callback);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
    return this;
  }

  // 通知内容变化
  notifyContentChange() {
    const content = this.getPlainContent();
    this.observers.forEach(callback => {
      try {
        callback(content);
      } catch (err) {
        console.error('Error in observer callback:', err);
      }
    });
  }

  // 获取编辑器实例
  static getInstance() {
    return MEditor.instance;
  }

  // 焦点设置
  focus() {
    this.editorContent.focus();
  }

  // 销毁组件
  destroy() {
    if (!MEditor.instance) return;

    // 移除所有事件监听器
    Object.entries(this._boundEvents).forEach(([event, handler]) => {
      this.editorContent.removeEventListener(event, handler);
    });

    // 清空观察者
    this.observers = [];

    // 清空内容
    this.clearContent();

    // 重置单例实例
    MEditor.instance = null;
  }

  // 关联到其他Element（如Vue组件）
  connectToElement(element) {
    // 添加一个观察者更新关联元素的值
    this.observeContent(content => {
      if (element.value !== undefined) {
        element.value = content;
      }

      // 尝试触发元素的输入事件（兼容Vue的v-model）
      try {
        const event = new Event('input', { bubbles: true });
        element.dispatchEvent(event);
      } catch (err) {
        console.error('Error dispatching input event:', err);
      }
    });

    return this;
  }
}

// 注册自定义元素
if (!customElements.get('m-editor')) {
  customElements.define('m-editor', MEditor);
}

// 导出MEditor类，方便在不同环境中使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MEditor;
} else if (typeof window !== 'undefined') {
  window.MEditor = MEditor;
}
