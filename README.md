# MEditor - 可插入自定义组件的Web编辑器

MEditor 是一个轻量级的 Web 组件编辑器，它允许在文本中插入和管理小组件。这些小组件可以作为整体添加和删除，适用于各种场景，如商品推广码、用户提及等。

## 功能特点

- 基于 Web Components，可在任何支持的浏览器中使用
- 组件作为整体添加和删除
- 支持多种组件前缀管理
- 自定义组件样式
- 内容回显功能
- 双向数据绑定
- 单例模式实现
- 支持在 Vue 和普通 HTML 中使用

## 使用方法

### 基础使用

```html
<!-- 引入 MEditor -->
<script src="MEditor.js"></script>

<!-- 在HTML中使用 -->
<m-editor id="myEditor"></m-editor>

<script>
  document.addEventListener('DOMContentLoaded', function() {
    const editorElement = document.getElementById('myEditor');
    let editor = null;
    
    // 编辑器就绪事件
    editorElement.addEventListener('editor-ready', function(e) {
      editor = e.detail;
      console.log('编辑器已就绪');
    });
    
    // 插入组件
    function insertComponent() {
      if (editor) {
        editor.insertComponent('ABCDEFG');
      }
    }
    
    // 获取内容
    function getContent() {
      if (editor) {
        return editor.getPlainContent();
      }
    }
  });
</script>
```

### 在 Vue 中使用

```html
<template>
  <div>
    <m-editor ref="editor" @editor-ready="onEditorReady"></m-editor>
    <button @click="insertComponent">插入组件</button>
    <button @click="getContent">获取内容</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      editor: null
    };
  },
  methods: {
    onEditorReady(e) {
      this.editor = e.detail;
    },
    insertComponent() {
      if (this.editor) {
        this.editor.insertComponent('ABCDEFG');
      }
    },
    getContent() {
      if (this.editor) {
        return this.editor.getPlainContent();
      }
    }
  }
};
</script>
```

## API 参考

### 方法

- `insertComponent(componentId, componentText)` - 插入组件
- `setComponentStyle(styleName, styleObject)` - 设置组件样式
- `addComponentPrefix(prefix)` - 添加组件前缀
- `removeComponentPrefix(prefix)` - 移除组件前缀
- `setContentWithComponents(contentString)` - 设置内容回显
- `clearContent()` - 清空编辑器
- `getContent()` - 获取HTML内容
- `getPlainContent()` - 获取纯文本内容
- `observeContent(callback)` - 添加内容观察者
- `unobserveContent(callback)` - 移除内容观察者
- `focus()` - 设置编辑器焦点
- `destroy()` - 销毁编辑器实例
- `connectToElement(element)` - 将编辑器连接到DOM元素

### 静态方法

- `MEditor.getInstance()` - 获取编辑器单例实例

## 许可证

MIT
