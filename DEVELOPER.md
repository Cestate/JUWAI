# 句外 JUWAI 开发者文档

## 1. 产品边界

当前版本是游客可用的轻量化 MVP，目标是验证：

`处境/图片输入 -> 场景与情绪理解 -> 六条句子 -> 复制/收藏 -> 句子卡片`

本版本不包含登录、社区、关注、评论、复杂搜索、收藏夹分类和服务端用户数据。收藏暂存在浏览器 `localStorage`。

## 2. 技术结构

- `index.html`：页面骨架、导航、输入、结果、收藏和卡片生成弹层。
- `styles.css`：编辑感、留白和响应式布局。
- `app.js`：状态、分类词典、本地场景理解、结果渲染、复制、收藏和 PNG 卡片导出。
- `CONTENT_TAXONOMY`：前端与未来后端共享的分类契约。

无构建依赖。开发预览可运行 `python -m http.server 4173`，生产环境可直接部署到任意静态托管。

## 3. 内容分类契约

`app.js` 中的 `CONTENT_TAXONOMY` 是唯一分类来源，当前枚举如下：

### 内容类型 `contentTypes`

`电影`、`文学`、`诗歌`、`歌词`、`网络表达`、`AI 原创`

### 情绪 `emotions`

`治愈`、`浪漫`、`孤独`、`自由`、`悲伤`、`松弛`、`热烈`、`克制`、`幽默`。

允许后端返回额外情绪标签，但前端筛选和统计应优先使用上述标准值。

### 场景 `scenes`

`旅行`、`生日`、`毕业`、`恋爱`、`失恋`、`朋友`、`工作`、`日常`、`节日`。

UI 可以显示更具体的组合文案，例如“旅行 / 风景”，但持久化字段应使用标准场景值，例如 `sceneTags: ["旅行"]`。

## 4. 句子对象

推荐结果和 LocalStorage 收藏中的句子对象至少包含：

```js
{
  id: "request-timestamp-index",
  text: "句子正文",
  contentType: "AI 原创",
  emotionTags: ["自由", "松弛"],
  sceneTags: ["旅行"],
  copyrightStatus: "AI Generated",
  source: "给一段刚刚好的出发",
  scene: "旅行 / 风景",
  featured: false
}
```

`type` 是当前 UI 的兼容字段，与 `contentType` 保持相同值。新代码应读取 `contentType`，旧数据仍可读取 `type`。

`copyrightStatus` 建议使用以下值：

- `Public Domain`：公版作品，需保留可核验来源。
- `Licensed`：已获得授权，需记录授权范围和凭证。
- `User Generated`：用户自行上传或创作。
- `AI Generated`：模型生成，明确展示“AI 原创”。
- `Restricted`：受限内容，不应在未确认权利时展示。
- `Unverified`：出处尚未核实，只能展示为未核实内容，不能伪装成引用。

当前离线 Demo 全部使用 `AI Generated`，不伪造电影台词、歌词或文学出处。

## 5. 真实 AI / RAG 接口

建议由服务端提供 `POST /api/understand`：

```json
{
  "text": "想发海边照片，不想太俗",
  "image": null,
  "tone": "克制"
}
```

返回结构：

```json
{
  "understanding": {
    "scene": "旅行 / 风景",
    "sceneTags": ["旅行"],
    "emotionTags": ["自由", "松弛"],
    "object": "海边照片",
    "style": "克制",
    "purpose": "社交发布"
  },
  "results": [
    {
      "id": "sentence-001",
      "text": "海风经过的时候，城市暂时与我无关。",
      "contentType": "AI 原创",
      "emotionTags": ["自由", "松弛"],
      "sceneTags": ["旅行"],
      "copyrightStatus": "AI Generated",
      "author": null,
      "work": null,
      "sourceReference": null
    }
  ]
}
```

RAG 链路建议保持为：

`LLM 意图理解 -> 标准化 scene/emotion/style -> 向量召回 -> 版权与安全过滤 -> 重排 -> AI 原创补充`

不要让模型直接编造作者、作品名或出处。引用类结果必须在入库时完成来源核验，并在返回中携带 `sourceReference`。

## 6. 从本地 Demo 切换到 API

保留 `createResults()` 的渲染职责，新增一个异步数据层即可：

```js
async function requestRecommendations(payload) {
  const response = await fetch('/api/understand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('recommendation_request_failed');
  return response.json();
}
```

生成按钮应展示 loading、失败提示和重试入口。API 密钥只能放在服务端，不能写入 `app.js` 或 HTML。

## 7. 数据与隐私

- Demo 的收藏 key 为 `juwai-saved-v1`，只保存句子对象，不保存原始图片二进制。
- 图片预览使用浏览器对象 URL，离开页面后由浏览器回收。
- 接入服务端 Vision 模型前，应在上传动作附近说明图片传输目的、存储时长和删除机制。
- 不要把个人照片、联系方式或浏览历史写入日志。

## 8. 扩展顺序

1. 接入真实 Vision + LLM 接口，保留本地 fallback。
2. 建立句库和版权字段，先上线可核验的公版/授权内容。
3. 增加标准分类筛选和召回评估，观察复制、收藏、卡片生成率。
4. 再考虑登录同步、收藏夹分类和历史记录，不要提前引入用户权限复杂度。
