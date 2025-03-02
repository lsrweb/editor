/**
 * 编辑器工具函数模块
 */
export class Utils {
  /**
   * 防抖函数
   * @param func 要执行的函数
   * @param wait 等待时间（毫秒）
   */
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  /**
   * 生成唯一ID
   * @param prefix ID前缀
   */
  static generateUniqueId(prefix = 'block') {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }
  
  /**
   * 转义HTML特殊字符
   * @param text 要转义的文本
   */
  static escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
  
  /**
   * 获取浏览器信息
   */
  static getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let version = 'Unknown';
    
    // 检测浏览器类型和版本
    if (ua.indexOf('Chrome') > -1) {
      browser = 'Chrome';
      const match = ua.match(/Chrome\/(\d+)/);
      if (match) version = match[1];
    } else if (ua.indexOf('Firefox') > -1) {
      browser = 'Firefox';
      const match = ua.match(/Firefox\/(\d+)/);
      if (match) version = match[1];
    } else if (ua.indexOf('Safari') > -1) {
      browser = 'Safari';
      const match = ua.match(/Version\/(\d+)/);
      if (match) version = match[1];
    } else if (ua.indexOf('MSIE') > -1 || ua.indexOf('Trident') > -1) {
      browser = 'IE';
      const match = ua.match(/(?:MSIE |rv:)(\d+)/);
      if (match) version = match[1];
    } else if (ua.indexOf('Edge') > -1) {
      browser = 'Edge';
      const match = ua.match(/Edge\/(\d+)/);
      if (match) version = match[1];
    }
    
    return { browser, version };
  }
  
  /**
   * 检测是否为移动设备
   */
  static isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  /**
   * 序列化DOM为字符串
   * @param node DOM节点
   */
  static serializeNode(node) {
    if (!node) return '';
    
    // 处理文本节点
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    
    // 处理元素节点
    if (node.nodeType === Node.ELEMENT_NODE) {
      // 跳过脚本标签
      if (node.tagName.toLowerCase() === 'script') {
        return '';
      }
      
      // 序列化子节点
      let childContent = '';
      for (let i = 0; i < node.childNodes.length; i++) {
        childContent += this.serializeNode(node.childNodes[i]);
      }
      
      // 自定义组件处理
      if (node.tagName.includes('-')) {
        if (node.hasAttribute('data-value')) {
          return node.getAttribute('data-value') || '';
        }
        return childContent || node.textContent;
      }
      
      return childContent;
    }
    
    return '';
  }
  
  /**
   * 格式化日期
   * @param date 日期对象或时间戳
   * @param format 格式字符串，例如 'YYYY-MM-DD hh:mm:ss'
   */
  static formatDate(date, format = 'YYYY-MM-DD') {
    if (!date) return '';
    
    const d = typeof date === 'number' ? new Date(date) : date;
    
    const formatMap = {
      YYYY: d.getFullYear(),
      MM: String(d.getMonth() + 1).padStart(2, '0'),
      DD: String(d.getDate()).padStart(2, '0'),
      hh: String(d.getHours()).padStart(2, '0'),
      mm: String(d.getMinutes()).padStart(2, '0'),
      ss: String(d.getSeconds()).padStart(2, '0')
    };
    
    return format.replace(/YYYY|MM|DD|hh|mm|ss/g, match => formatMap[match]);
  }
  
  /**
   * 获取随机颜色
   */
  static getRandomColor() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  }
  
  /**
   * 深拷贝对象
   * @param obj 要拷贝的对象
   */
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item));
    }
    
    if (obj instanceof Object) {
      const copy = {};
      for (const attr in obj) {
        if (obj.hasOwnProperty(attr)) {
          copy[attr] = this.deepClone(obj[attr]);
        }
      }
      return copy;
    }
    
    throw new Error('无法复制对象，不支持的类型');
  }
  
  /**
   * 截取HTML内容的摘要
   * @param html HTML内容
   * @param maxLength 最大长度
   */
  static getHtmlSummary(html, maxLength = 100) {
    // 创建临时元素解析HTML
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    
    // 获取纯文本内容
    const text = tmp.textContent || tmp.innerText || '';
    
    // 截取指定长度
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength) + '...';
  }
}
