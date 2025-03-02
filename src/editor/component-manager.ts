
/**
 * 组件管理模块，负责组件的注册和获取
 */
export class ComponentManager {
  /**
   * 注册新组件
   * @param componentsMap 组件映射表
   * @param type 组件类型
   * @param config 组件配置
   */
  static registerComponent(componentsMap, type, config) {
    // 保存组件默认配置
    componentsMap.set(type, {
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
   * @param componentsMap 组件映射表
   * @param type 组件类型
   */
  static getComponent(componentsMap, type) {
    return componentsMap.get(type);
  }

  /**
   * 创建组件实例
   * @param componentsMap 组件映射表
   * @param type 组件类型
   * @param data 组件数据
   * @param options 组件选项
   */
  static createComponentInstance(componentsMap, type, data = {}, options = {}) {
    const config = this.getComponent(componentsMap, type);
    if (!config || !config.constructor) {
      console.error(`组件类型 "${type}" 未注册`);
      return null;
    }

    try {
      // 创建组件实例
      const instance = new config.constructor();
      
      // 设置唯一ID
      const blockId = `block-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      instance.id = blockId;
      
      // 设置组件配置
      if (typeof instance.setConfig === 'function') {
        const mergedConfig = {
          ...config.defaultConfig,
          ...(options.config || {})
        };
        instance.setConfig(mergedConfig);
      }
      
      // 设置前缀
      if (config.prefix && typeof instance.setPrefix === 'function') {
        instance.setPrefix(config.prefix);
      }
      
      // 设置模板
      if (config.template && typeof instance.setTemplate === 'function') {
        instance.setTemplate(config.template);
      }
      
      // 设置数据
      if (typeof instance.setData === 'function') {
        const componentData = {
          id: blockId,
          ...data
        };
        instance.setData(componentData);
      }
      
      return instance;
    } catch (error) {
      console.error(`创建组件实例失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 检查组件是否有效
   * @param component 组件实例
   */
  static isValidComponent(component) {
    return component && 
           component.tagName && 
           component.tagName.includes('-') &&
           component.id && 
           component.id.startsWith('block-');
  }

  /**
   * 获取组件的全值
   * @param component 组件实例
   */
  static getComponentFullValue(component) {
    if (!this.isValidComponent(component)) {
      return '';
    }
    
    if (typeof component.getFullValue === 'function') {
      return component.getFullValue();
    }
    
    if (component._data && component._data.value) {
      return component._data.value;
    }
    
    return '';
  }
}
