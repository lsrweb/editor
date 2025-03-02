/**
 * 京东礼金组件
 */
class JDCoupon extends MCouponBlock {
    static tagName = 'jd-coupon';
    static prefix = 'TLJ-PLJDLJ';
    static couponType = "jd"; // 组件类型标识
    static defaultIcon = "🎁"; // 默认图标
    static styleClass = "jd-style"; // CSS类

    // 添加自定义匹配模式
    static getPatterns(escapedPrefix) {
        return [
            // 花括号格式 {TLJ-PLJDLJ-ABC123}，支持更多特殊字符
            {
                regex: new RegExp(`\\{${escapedPrefix}[-_]?([^}]+)\\}`, 'g'),
                extract: (match) => match[1]
            },
            // 标准格式，支持更多特殊字符
            {
                regex: new RegExp(`\\[${escapedPrefix}([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)\\]`, 'g'),
                extract: (match) => match[1]
            },
            // 直接格式，支持更多特殊字符
            {
                regex: new RegExp(`${escapedPrefix}-([\\w\\d\\-\\.\\+\\=\\&\\!\\?\\%]+)`, 'g'),
                extract: (match) => match[1]
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

// 注册组件
customElements.define(JDCoupon.tagName, JDCoupon);

// 注册到编辑器
JDCoupon.register(MEditor);
