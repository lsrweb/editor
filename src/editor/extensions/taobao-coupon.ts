import { MCouponBlock } from '../coupon-block';

/**
 * 淘宝礼金组件 TypeScript版本
 */
export class TaobaoCoupon extends MCouponBlock {
  static tagName: string = "taobao-coupon";
  static prefix: string = "TLJ-PLLJ";
  static couponType: string = "taobao"; // 组件类型标识
  static defaultIcon: string = "🎁"; // 默认图标
  static styleClass: string = "taobao-style"; // CSS类
  static iconClass: string = "taobao-icon"; // 图标类名

  static getPatterns(escapedPrefix: string) {
    return [
      // 花括号格式 {TLJ-PLLJ-1iTgI9}，修正连字符匹配，支持更多特殊字符
      {
        regex: new RegExp(`\\{${escapedPrefix}[-_]?([^}]+)\\}`, "g"),
        extract: (match: RegExpExecArray) => match[1],
      },
      // 处理带连字符的格式 TLJ-PLLJ-1iTgI9，支持更多字符
      {
        regex: new RegExp(`${escapedPrefix}-([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)`, "g"),
        extract: (match: RegExpExecArray) => match[1],
      },
      // 处理带下划线的格式 TLJ-PLLJ_1iTgI9，支持更多字符
      {
        regex: new RegExp(`${escapedPrefix}_([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)`, "g"),
        extract: (match: RegExpExecArray) => match[1],
      },
      // 支持方括号格式 [TLJ-PLLJ-1iTgI9]，支持更多字符
      {
        regex: new RegExp(`\\[${escapedPrefix}[-_]?([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)\\]`, "g"),
        extract: (match: RegExpExecArray) => match[1],
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

    // 检查是否是回显组件
    const isRestoreComponent = data.isRestore || config.isRestore || this.classList.contains('is-restore');

    // 如果是回显组件且有原始格式，直接使用原始格式渲染
    if (isRestoreComponent && data.originalFormat) {
      const iconClass = (this.constructor as typeof TaobaoCoupon).iconClass || 'default-icon';
      const defaultIcon = (this.constructor as typeof TaobaoCoupon).defaultIcon || '🎁';

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
}

// 如果在浏览器环境中，自动注册为Web组件
if (typeof window !== 'undefined' && !window.customElements.get(TaobaoCoupon.tagName)) {
  window.customElements.define(TaobaoCoupon.tagName, TaobaoCoupon);
}
