# OpenAI Chat Demo

## 简介

使用 OpenAI JavaScript SDK 在浏览器里实现一个可配置 Base URL、Model、API Key 的流式对话界面。

## 快速开始

### 环境要求

Node.js 18+

### 运行

```bash
pnpm install
pnpm dev
```

默认端口 `52741`，启动后自动打开浏览器。

## 概念讲解

### 第一部分：浏览器中使用 OpenAI SDK

OpenAI 官方 SDK 默认禁止在浏览器环境使用，防止 API Key 泄露。通过 `dangerouslyAllowBrowser: true` 显式开启：

```typescript
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'sk-xxx',
  dangerouslyAllowBrowser: true,
})
```

**注意**：这会把 API Key 暴露给前端，仅适合本地 Demo 或个人使用。生产环境应走后端代理。

### 第二部分：流式响应

SDK 支持 `stream: true` 逐字返回内容：

```typescript
const stream = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: '你好' }],
  stream: true,
})

for await (const chunk of stream) {
  const text = chunk.choices[0]?.delta?.content || ''
  // 逐段追加到界面
}
```

### 第三部分：可中断请求

用 `AbortController` 中断进行中的请求：

```typescript
const controller = new AbortController()

const stream = await client.chat.completions.create(
  { /* ... */ },
  { signal: controller.signal }
)

// 点击停止按钮时
controller.abort()
```

## 完整示例

```tsx
import { useState, useRef, useCallback } from 'react'
import { Card, Input, Button, Flex, Typography, Alert } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import OpenAI from 'openai'

const { TextArea } = Input
const { Text } = Typography

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function App() {
  const [baseURL, setBaseURL] = useState('https://api.openai.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(async () => {
    if (!input.trim() || loading) return
    if (!apiKey.trim()) {
      setError('请填写 API Key')
      return
    }
    setError('')

    const userMsg: Message = { role: 'user', content: input.trim() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    // 先放一个空的 assistant 消息占位
    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages([...nextMessages, assistantMsg])

    const client = new OpenAI({
      baseURL: baseURL.trim(),
      apiKey: apiKey.trim(),
      dangerouslyAllowBrowser: true,
    })

    abortRef.current = new AbortController()

    try {
      const stream = await client.chat.completions.create(
        {
          model: model.trim(),
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: true,
        },
        { signal: abortRef.current.signal }
      )

      let full = ''
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || ''
        full += delta
        // 每收到一段就更新最后一条消息
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: full }
          return copy
        })
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message || '请求失败')
      }
      // 出错时移除占位消息
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [input, loading, apiKey, baseURL, model, messages])

  return (
    <Flex vertical style={{ height: '100vh' }}>
      {/* 配置区 */}
      <Input
        placeholder="Base URL"
        value={baseURL}
        onChange={(e) => setBaseURL(e.target.value)}
      />
      <Input
        placeholder="Model"
        value={model}
        onChange={(e) => setModel(e.target.value)}
      />
      <Input.Password
        placeholder="API Key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />

      {/* 消息列表 */}
      {messages.map((m, i) => (
        <Card key={i}>
          <Text strong>{m.role === 'user' ? '你' : 'AI'}</Text>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{m.content}</Text>
        </Card>
      ))}

      {/* 输入区 */}
      <TextArea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onPressEnter={(e) => {
          if (!e.shiftKey) {
            e.preventDefault()
            send()
          }
        }}
      />
      <Button type="primary" loading={loading} onClick={send}>
        发送
      </Button>
    </Flex>
  )
}
```

## 注意事项

- 浏览器端直接使用 API Key 有泄露风险，仅用于本地测试
- 支持任意兼容 OpenAI API 格式的服务（如自托管、第三方代理）
- 按 Enter 发送，Shift + Enter 换行

## 中文完整讲解

这个 Demo 演示了如何在前端直接使用 OpenAI 的官方 JavaScript SDK 做流式对话。

整个界面分成三块：顶部的配置面板、中间的消息列表、底部的输入框。

配置面板里可以填三项：Base URL、Model、API Key。Base URL 默认是 OpenAI 官方地址，你可以改成任何兼容 OpenAI API 格式的地址，比如国内的代理服务或者自部署的模型。Model 默认是 `gpt-4o-mini`，也可以换成 `gpt-4o`、`claude` 等其它模型，前提是 Base URL 支持。API Key 是必填项，不填会提示错误。

点击发送后，代码先用 `useState` 把用户消息追加到列表，然后立刻追加一条空的 AI 消息作为占位。接着创建 `OpenAI` 客户端实例，这里关键是 `dangerouslyAllowBrowser: true`，没有这个参数 SDK 会在浏览器里报错拒绝运行。

请求参数里 `stream: true` 表示要流式返回。`for await (const chunk of stream)` 是 JavaScript 的异步迭代语法，每循环一次就收到一小块内容，立刻更新到最后一条 AI 消息里。这样用户看到的不是等全部内容返回后才显示，而是一个字一个字跳出来。

如果用户点击停止按钮，或者网络出错，代码通过 `AbortController` 中断请求，并在 `catch` 里把占位消息删掉，避免界面留下一条空消息。

整个状态管理全部用 React 的 `useState` 和 `useRef`，没有引入额外的状态库，保持最小依赖。
