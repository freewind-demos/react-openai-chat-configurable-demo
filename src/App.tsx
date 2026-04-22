import { useState, useRef, useCallback } from 'react'
import {
  Card,
  Input,
  Button,
  Flex,
  Typography,
  Space,
  Alert,
  Divider,
} from 'antd'
import { SendOutlined, SettingOutlined } from '@ant-design/icons'
import OpenAI from 'openai'

const { TextArea } = Input
const { Text } = Typography

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function App() {
  const [configOpen, setConfigOpen] = useState(true)
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
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [input, loading, apiKey, baseURL, model, messages])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return (
    <Flex vertical style={{ height: '100vh', background: '#f5f5f5' }}>
      {/* header */}
      <Flex
        align="center"
        justify="space-between"
        style={{
          padding: '12px 24px',
          background: '#fff',
          borderBottom: '1px solid #eee',
        }}
      >
        <Text strong style={{ fontSize: 16 }}>
          OpenAI Chat
        </Text>
        <Button
          icon={<SettingOutlined />}
          type={configOpen ? 'primary' : 'default'}
          onClick={() => setConfigOpen((v) => !v)}
        >
          配置
        </Button>
      </Flex>

      {/* config panel */}
      {configOpen && (
        <Card size="small" style={{ margin: 12, marginBottom: 0 }}>
          <Flex vertical gap={8}>
            <Input
              placeholder="Base URL，如 https://api.openai.com/v1"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
            />
            <Input
              placeholder="Model，如 gpt-4o-mini"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
            <Input.Password
              placeholder="API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </Flex>
        </Card>
      )}

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          style={{ margin: '12px 12px 0' }}
          closable
          onClose={() => setError('')}
        />
      )}

      {/* messages */}
      <Flex
        vertical
        gap={12}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
        }}
      >
        {messages.length === 0 && (
          <Flex justify="center" align="center" style={{ flex: 1 }}>
            <Text type="secondary">在下方输入消息开始对话</Text>
          </Flex>
        )}
        {messages.map((m, i) => (
          <Card
            key={i}
            size="small"
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              background: m.role === 'user' ? '#e6f7ff' : '#fff',
            }}
          >
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              {m.role === 'user' ? '你' : 'AI'}
            </Text>
            <Text style={{ whiteSpace: 'pre-wrap' }}>{m.content}</Text>
          </Card>
        ))}
      </Flex>

      <Divider style={{ margin: 0 }} />

      {/* input */}
      <Flex gap={8} style={{ padding: 12, background: '#fff' }}>
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          disabled={loading}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={loading}
          onClick={send}
        >
          发送
        </Button>
        {loading && (
          <Button danger onClick={stop}>
            停止
          </Button>
        )}
      </Flex>
    </Flex>
  )
}

export default App
