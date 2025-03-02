import { MEditorCore } from './editor/core';
import { DOMHandler } from './editor/dom-handler';
import { EventHandler } from './editor/event-handler';
import { ContentProcessor } from './editor/content-processor';
import { ComponentManager } from './editor/component-manager';
import { Utils } from './editor/utils';


import "./editor/block"
import "./editor/coupon-block"


import "./css/components.css"
import "./css/style.css"

/**
 * 富文本编辑器组件
 */
class MEditor extends MEditorCore {
  static components = new Map();
  _initialized: boolean;
  _editorContainer: null;
  _clearButton: null;
  _value: string;
  _updating: boolean;
  _isRestoring: boolean;
  _readyCallbacks: never[];

  constructor() {
    super();
    
    // 混入各功能模块
    Object.assign(
      this,
      DOMHandler.methods,
      EventHandler.methods,
      ContentProcessor.methods
    );

    // 初始化实例属性
    this._initialized = false;
    this._editorContainer = null;
    this._clearButton = null;
    this._value = '';
    this._updating = false;
    this._isRestoring = false;
    this._readyCallbacks = [];
  }
  
  /**
   * 检测是否为Vue环境
   */
  static isVueEnvironment() {
    return typeof window !== 'undefined' && typeof window.Vue !== 'undefined';
  }

  /**
   * 注册新组件
   */
  static registerComponent(type: any, config: any) {
    ComponentManager.registerComponent(MEditor.components, type, config);
  }

  /**
   * 获取已注册的组件
   */
  static getComponent(type: any) {
    return MEditor.components.get(type);
  }
}

// 注册组件
if (!customElements.get('m-editor')) {
  customElements.define('m-editor', MEditor);
}

export default MEditor;
