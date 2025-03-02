/**
 * 编辑器核心类
 */
export class MEditorCore extends HTMLElement {
  _initialized: boolean = false;
  _editorContainer!: HTMLDivElement | null;
  _clearButton!: HTMLButtonElement | null;
  _value!: string;
  _updating: boolean = false;
  _isRestoring: boolean = false;
  _readyCallbacks: Array<Function> = [];
  _observer!: MutationObserver | null;
  _updateTimer!: number | null;
  
  /**
   * 连接到DOM时调用
   */
  connectedCallback() {
    // 在连接到DOM时设置属性
    this.setAttribute('contenteditable', this.disabled ? 'false' : 'true');
    this.setAttribute('spellcheck', 'false');

    // 创建清空按钮（延迟到这里创建DOM）
    if (!this._clearButton) {
      this._createClearButton();
    }

    // 适配Vue环境
    if ((this.constructor as typeof MEditorCore).isVueEnvironment()) {
      // 在Vue环境下，可能需要延迟执行DOM操作以确保Vue已完成处理
      setTimeout(() => this._initializeEditor(), 16);
    } else {
      // 非Vue环境，直接初始化
      this._initializeEditor();
    }

    // 检查是否禁用
    this._updateDisabledState();
  }

  /**
   * 从DOM断开连接时调用
   */
  disconnectedCallback() {
    this._removeListeners();
  }

  /**
   * 观察属性变化
   */
  static get observedAttributes() {
    return ['disabled', 'value'];
  }

  /**
   * 当观察的属性变化时调用
   */
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'disabled') {
      this._updateDisabledState();
    } else if (name === 'value' && oldValue !== newValue) {
      // 避免循环更新
      if (this._value !== newValue) {
        this.setValue(newValue || '');
      }
    }
  }

  /**
   * 获取禁用状态
   */
  get disabled() {
    return this.hasAttribute('disabled');
  }

  /**
   * 设置禁用状态
   */
  set disabled(value) {
    if (value) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }

  /**
   * 获取编辑器值
   */
  get value() {
    return this._value;
  }

  /**
   * 设置编辑器值
   */
  set value(newValue) {
    if (this._value !== newValue) {
      this.setValue(newValue);
    }
  }

  // 新增方法声明
  clearContent!: () => MEditorCore;
  insertBlock!: (type: string, data?: any, config?: any) => HTMLElement | null;
  appendText!: (text: string, position?: string) => MEditorCore;
  parseContentWithComponents!: (content: string, options?: any) => string | HTMLElement;
  focus!: () => MEditorCore;

  // 这些方法将在其他模块中实现
  _createClearButton!: () => void;
  _initializeEditor!: () => void;
  _updateDisabledState!: () => void;
  _removeListeners!: () => void;
  setValue!: (value: string) => MEditorCore;
  
  // 静态方法占位
  static isVueEnvironment: () => boolean;
}
