/**
 * 淘宝礼金组件
 */
class TaobaoCoupon extends MCouponBlock {
  static tagName = "taobao-coupon";
  static prefix = "TLJ-PLLJ";
  static couponType = "taobao"; // 组件类型标识
  static defaultIcon = "🎁"; // 默认图标
  static styleClass = "taobao-style"; // CSS类

  static getPatterns(escapedPrefix) {
    return [
      // 花括号格式 {TLJ-PLLJ-1iTgI9}，修正连字符匹配，支持更多特殊字符
      {
        regex: new RegExp(`\\{${escapedPrefix}[-_]?([^}]+)\\}`, "g"),
        extract: (match) => match[1],
      },
      // 处理带连字符的格式 TLJ-PLLJ-1iTgI9，支持更多字符
      {
        regex: new RegExp(`${escapedPrefix}-([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)`, "g"),
        extract: (match) => match[1],
      },
      // 处理带下划线的格式 TLJ-PLLJ_1iTgI9，支持更多字符
      {
        regex: new RegExp(`${escapedPrefix}_([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)`, "g"),
        extract: (match) => match[1],
      },
      // 支持方括号格式 [TLJ-PLLJ-1iTgI9]，支持更多字符
      {
        regex: new RegExp(`\\[${escapedPrefix}[-_]?([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)\\]`, "g"),
        extract: (match) => match[1],
      },
    ];
  }

  constructor() {
    super();
    this.classList.add("taobao-coupon");
    this.setPrefix(TaobaoCoupon.prefix);

    // 设置默认配置
    this.setConfig({
      label_key: 'name',
      value_key: 'code',
      default_text: '淘宝礼金',
      clickable: true  // 默认可点击
    });
  }

  /**
   * 重写渲染方法，确保回显时直接显示原始格式
   */
  _render() {
    // 获取组件数据和配置
    const data = this.getData();
    const config = this._config || {};

    // 调试输出，查看组件状态
    console.log('淘宝礼金组件渲染:', {
      isRestore: data.isRestore,
      configIsRestore: config.isRestore,
      hasClass: this.classList.contains('is-restore'),
      originalFormat: data.originalFormat,
      value: data.value
    });

    // 检查是否是回显组件
    const isRestoreComponent = data.isRestore || config.isRestore || this.classList.contains('is-restore');

    // 如果是回显组件且有原始格式，直接使用原始格式渲染
    if (isRestoreComponent && data.originalFormat) {
      const iconClass = this.constructor.iconClass || 'default-icon';
      const defaultIcon = this.constructor.defaultIcon || '🎁';

      // 使用更简单的渲染结构，确保原始格式显示
      this.innerHTML = `
        <div class="block-content taobao-style is-restore">
          <span class="block-icon ${iconClass}">${defaultIcon}</span>
          <span class="block-label">${data.originalFormat}</span>
        </div>
      `;
      return;
    }

    // 非回显情况，调用父类的渲染方法
    super._render();
  }

  // 所有共用方法都继承自 MCouponBlock
}

// 注册组件
customElements.define(TaobaoCoupon.tagName, TaobaoCoupon);

// 修改注册到编辑器的方式
// 使用 document ready 事件来确保 MEditor 已加载
document.addEventListener('DOMContentLoaded', function() {
  // 检查 MEditor 是否可用
  if (typeof MEditor !== 'undefined') {
    // 直接注册
    TaobaoCoupon.register(MEditor);
    console.log('淘宝礼金组件已注册到编辑器');
  } else {
    // 如果不可用，等待 editor-ready 事件
    document.addEventListener('editor-ready', function(e) {
      TaobaoCoupon.register(e.detail.editor);
      console.log('淘宝礼金组件已注册到编辑器（延迟注册）');
    });
    console.warn('MEditor 尚未加载，淘宝礼金组件将在编辑器就绪后注册');
  }
});
