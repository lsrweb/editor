/**
 * 富文本编辑器组件
 */
class MEditor extends HTMLElement {
  static components = new Map();

  /**
   * 注册新组件
   * @param {string} type 组件类型
   * @param {object} config 组件配置
   */
  static registerComponent(type, config) {
    // 保存组件默认配置
    MEditor.components.set(type, {
      ...config,
      defaultConfig: {
        prefix: config.prefix,
        template: config.template || '${prefix}_${value}',
        // 可以添加更多默认配置...
      }
    });
  }

  /**
   * 获取已注册的组件
   * @param {string} type 组件类型
   */
  static getComponent(type) {
    return MEditor.components.get(type);
  }

  constructor() {
    super();
    this.setAttribute('contenteditable', 'true');
    this.setAttribute('spellcheck', 'false');

    // 保存原始MutationObserver的引用
    this._origMutationObserver = window.MutationObserver;
  }

  connectedCallback() {
    this._setupListeners();
    this._setupPlaceholder();
  }

  disconnectedCallback() {
    this._removeListeners();
  }

  /**
   * 设置事件监听器
   */
  _setupListeners() {
    // 处理光标位置和粘贴事件
    this.addEventListener('paste', this._handlePaste.bind(this));
    this.addEventListener('keydown', this._handleKeydown.bind(this));

    // 监听DOM变化，处理自定义组件
    this._observer = new MutationObserver(this._handleMutations.bind(this));
    this._observer.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });
  }

  /**
   * 移除事件监听器
   */
  _removeListeners() {
    if (this._observer) {
      this._observer.disconnect();
    }
  }

  /**
   * 设置占位符
   */
  _setupPlaceholder() {
    if (this.hasAttribute('placeholder')) {
      // 如果元素为空，添加placeholder类
      this._checkPlaceholder();
      this.addEventListener('input', this._checkPlaceholder.bind(this));
      this.addEventListener('focus', this._checkPlaceholder.bind(this));
      this.addEventListener('blur', this._checkPlaceholder.bind(this));
    }
  }

  /**
   * 检查并处理占位符
   */
  _checkPlaceholder() {
    if (!this.textContent.trim()) {
      this.classList.add('empty');
    } else {
      this.classList.remove('empty');
    }
  }

  /**
   * 处理粘贴事件
   */
  _handlePaste(e) {
    e.preventDefault();

    // 获取纯文本并插入
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  /**
   * 处理键盘事件
   */
  _handleKeydown(e) {
    // 处理Tab键
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  }

  /**
   * 处理DOM变化
   */
  _handleMutations(mutations) {
    // 在这里可以处理特定的DOM变化
    // 例如确保自定义组件不被编辑器内部的格式化操作破坏
  }

  /**
   * 获取编辑器内容
   * 
   * @param {boolean} filterEmpty 是否过滤空值
   * @returns {string} 编辑器格式化内容
   */
  getContent(filterEmpty = true) {
    // 创建一个克隆节点以处理内容
    const clone = this.cloneNode(true);

    // 处理所有已注册的组件
    MEditor.components.forEach((config, type) => {
      const components = clone.querySelectorAll(type);
      components.forEach(component => {
        const originalComponent = this.querySelector(`#${component.id}`);
        if (originalComponent) {
          const hasValue = originalComponent.hasValidValue && originalComponent.hasValidValue();
          
          if (filterEmpty && !hasValue) {
            component.remove();
          } else {
            const fullValue = originalComponent.getFullValue();
            const textNode = document.createTextNode(fullValue);
            component.replaceWith(textNode);
          }
        }
      });
    });

    return clone.textContent.trim();
  }

  /**
   * 获取原始内容
   * @returns {string} 编辑器原始HTML内容
   */
  getRawContent() {
    return this.innerHTML;
  }

  /**
   * 在当前光标位置插入块
   * @param {string} type 组件类型
   * @param {Object} data 组件数据
   * @param {Object} config 组件配置
   */
  insertBlock(type, data = {}, config = {}) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    
    // 获取注册的组件配置
    const componentConfig = MEditor.getComponent(type);
    if (!componentConfig || !componentConfig.constructor) {
      console.error(`Component type "${type}" not registered`);
      return;
    }

    // 创建组件实例
    const block = new componentConfig.constructor();
    
    // 设置唯一ID
    const blockId = `block-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    block.id = blockId;

    // 合并默认配置和自定义配置
    const mergedConfig = {
      ...componentConfig.defaultConfig,
      ...config
    };

    // 设置组件配置
    if (block.setConfig) {
      block.setConfig(mergedConfig);
    }

    // 设置前缀（如果提供）
    if (mergedConfig.prefix) {
      block.setPrefix(mergedConfig.prefix);
    }

    // 设置模板（如果提供）
    if (config.template) {
      block.setTemplate(config.template);
    } else if (componentConfig.defaultConfig.template) {
      block.setTemplate(componentConfig.defaultConfig.template);
    }

    // 设置初始数据
    if (block.setData) {
      block.setData({
        id: blockId,
        ...data
      });
    }

    // 插入到当前光标位置
    range.deleteContents();
    range.insertNode(block);
    
    const space = document.createTextNode('\u00A0');
    range.setStartAfter(block);
    range.setEndAfter(block);
    range.insertNode(space);
    
    range.setStartAfter(space);
    range.setEndAfter(space);
    selection.removeAllRanges();
    selection.addRange(range);

    return block;
  }
}

// 注册组件
customElements.define('m-editor', MEditor);
