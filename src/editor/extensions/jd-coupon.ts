import { MCouponBlock } from '../coupon-block';

/**
 * 京东礼金组件 TypeScript版本
 */
export class JDCoupon extends MCouponBlock {
  static tagName: string = 'jd-coupon';
  static prefix: string = 'TLJ-PLJDLJ';
  static couponType: string = "jd"; // 组件类型标识
  static defaultIcon: string = "🎁"; // 默认图标
  static styleClass: string = "jd-style"; // CSS类
  static iconClass: string = "jd-icon"; // 图标类名

  // 添加自定义匹配模式
  static getPatterns(escapedPrefix: string) {
    return [
      // 花括号格式 {TLJ-PLJDLJ-ABC123}，支持更多特殊字符
      {
        regex: new RegExp(`\\{${escapedPrefix}[-_]?([^}]+)\\}`, 'g'),
        extract: (match: RegExpExecArray) => match[1]
      },
      // 标准格式，支持更多特殊字符
      {
        regex: new RegExp(`\\[${escapedPrefix}([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)\\]`, 'g'),
        extract: (match: RegExpExecArray) => match[1]
      },
      // 直接格式，支持更多特殊字符
      {
        regex: new RegExp(`${escapedPrefix}-([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)`, 'g'),
        extract: (match: RegExpExecArray) => match[1]
      }
    ];
  }

  constructor() {
    super();
    this.classList.add('jd-coupon');
    this.setPrefix(JDCoupon.prefix);

    // 设置默认配置
    this.setConfig({
      label_key: 'name',
      value_key: 'code',
      default_text: '京东礼金',
      clickable: true  // 默认可点击
    });
  }
  
  // 所有共用方法都继承自 MCouponBlock
}

// 如果在浏览器环境中，自动注册为Web组件
if (typeof window !== 'undefined' && !window.customElements.get(JDCoupon.tagName)) {
  window.customElements.define(JDCoupon.tagName, JDCoupon);
}
