import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Typography from '@tiptap/extension-typography'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Minus,
  PilcrowSquare,
} from 'lucide-react'
import { useEffect } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  autofocus?: boolean
  ariaLabel?: string
}

const isHtml = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value)

const initialContent = (raw: string) => {
  if (!raw) return ''
  if (isHtml(raw)) return raw
  // Convert plain text to paragraphs preserving line breaks
  return raw
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
  children: React.ReactNode
  shortcut?: string
}

function ToolbarButton({ onClick, active, disabled, label, children, shortcut }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-secondary/30 rounded-t-md">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        label="Titolo 1"
        shortcut="Cmd+Alt+1"
      >
        <Heading1 className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        label="Titolo 2"
        shortcut="Cmd+Alt+2"
      >
        <Heading2 className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        label="Titolo 3"
        shortcut="Cmd+Alt+3"
      >
        <Heading3 className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setParagraph().run()}
        active={editor.isActive('paragraph')}
        label="Paragrafo"
      >
        <PilcrowSquare className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>

      <span className="w-px h-5 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        label="Grassetto"
        shortcut="Cmd+B"
      >
        <Bold className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        label="Corsivo"
        shortcut="Cmd+I"
      >
        <Italic className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        label="Barrato"
        shortcut="Cmd+Shift+X"
      >
        <Strikethrough className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        label="Codice inline"
        shortcut="Cmd+E"
      >
        <Code className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>

      <span className="w-px h-5 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        label="Elenco puntato"
        shortcut="Cmd+Shift+8"
      >
        <List className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        label="Elenco numerato"
        shortcut="Cmd+Shift+7"
      >
        <ListOrdered className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive('taskList')}
        label="Lista di attività"
      >
        <CheckSquare className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        label="Citazione"
        shortcut="Cmd+Shift+B"
      >
        <Quote className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        label="Linea orizzontale"
      >
        <Minus className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>

      <span className="w-px h-5 bg-border mx-1" />

      <ToolbarButton
        onClick={() => {
          const previousUrl = editor.getAttributes('link').href
          const url = window.prompt('URL del link:', previousUrl || 'https://')
          if (url === null) return
          if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
          }
          editor
            .chain()
            .focus()
            .extendMarkRange('link')
            .setLink({ href: url })
            .run()
        }}
        active={editor.isActive('link')}
        label="Link"
        shortcut="Cmd+K"
      >
        <LinkIcon className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>

      <span className="w-px h-5 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        label="Annulla"
        shortcut="Cmd+Z"
      >
        <Undo2 className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        label="Ripeti"
        shortcut="Cmd+Shift+Z"
      >
        <Redo2 className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
    </div>
  )
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Inizia a scrivere...',
  minHeight = '180px',
  autofocus = false,
  ariaLabel,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Ensure basic markdown shortcuts are enabled (StarterKit defaults)
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          'before:content-[attr(data-placeholder)] before:absolute before:text-muted-foreground before:opacity-50 before:pointer-events-none',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-2',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Typography,
    ],
    content: initialContent(value),
    autofocus,
    editorProps: {
      attributes: {
        'aria-label': ariaLabel || 'Editor di testo',
        class:
          'prose prose-sm max-w-none focus:outline-none px-4 py-3 min-h-[var(--editor-min-height)] dark:prose-invert ' +
          'prose-headings:font-display prose-headings:font-semibold prose-headings:tracking-tight ' +
          'prose-p:my-2 prose-li:my-0 prose-ul:my-2 prose-ol:my-2 ' +
          'prose-blockquote:border-l-2 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic ' +
          'prose-code:before:content-none prose-code:after:content-none prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      // Normalize empty editor to empty string
      const normalized = html === '<p></p>' ? '' : html
      onChange(normalized)
    },
  })

  // Sync external value changes (e.g., when switching notes)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const incoming = initialContent(value)
    if (current !== incoming && (incoming || current !== '<p></p>')) {
      editor.commands.setContent(incoming || '', { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value])

  return (
    <div
      className="border border-border rounded-md focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all"
      style={{ ['--editor-min-height' as any]: minHeight }}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="bg-background rounded-b-md" />
    </div>
  )
}
