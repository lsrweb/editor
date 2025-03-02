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

  // 所有共用方法都继承自 MCouponBlock
}

// 注册组件
customElements.define(TaobaoCoupon.tagName, TaobaoCoupon);

// 注册到编辑器
TaobaoCoupon.register(MEditor);
