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
  Keyboard,
} from 'lucide-react'
import { useEffect, useState } from 'react'

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
      tabIndex={-1}
      onPointerDown={(e) => {
        e.preventDefault()
        if (!disabled) onClick()
      }}
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

function Toolbar({
  editor,
  showHelp,
  onToggleHelp,
}: {
  editor: Editor | null
  showHelp: boolean
  onToggleHelp: () => void
}) {
  // Force re-render on every transaction so toolbar reflects stored marks
  // (e.g., clicking Bold with no selection should immediately highlight the
  // button, even though no character has been typed yet)
  const [, forceUpdate] = useState({})
  useEffect(() => {
    if (!editor) return
    const update = () => forceUpdate({})
    editor.on('transaction', update)
    editor.on('selectionUpdate', update)
    return () => {
      editor.off('transaction', update)
      editor.off('selectionUpdate', update)
    }
  }, [editor])

  if (!editor) return null

  // Check if a mark is "primed" via stored marks (clicked but not yet typed)
  const isMarkActive = (markName: string) => {
    if (editor.isActive(markName)) return true
    const stored = editor.state.storedMarks
    if (!stored) return false
    return stored.some((m) => m.type.name === markName)
  }

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
        active={isMarkActive('bold')}
        label="Grassetto"
        shortcut="Cmd+B"
      >
        <Bold className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={isMarkActive('italic')}
        label="Corsivo"
        shortcut="Cmd+I"
      >
        <Italic className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={isMarkActive('strike')}
        label="Barrato"
        shortcut="Cmd+Shift+X"
      >
        <Strikethrough className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={isMarkActive('code')}
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

      <span className="ml-auto" />

      <ToolbarButton
        onClick={onToggleHelp}
        active={showHelp}
        label="Mostra scorciatoie"
      >
        <Keyboard className="w-4 h-4" strokeWidth={2} />
      </ToolbarButton>
    </div>
  )
}

const SHORTCUTS: Array<{ section: string; items: Array<[string, string]> }> = [
  {
    section: 'Formattazione',
    items: [
      ['Grassetto', 'Cmd/Ctrl+B oppure **testo**'],
      ['Corsivo', 'Cmd/Ctrl+I oppure *testo*'],
      ['Barrato', 'Cmd/Ctrl+Shift+X oppure ~~testo~~'],
      ['Codice inline', 'Cmd/Ctrl+E oppure `testo`'],
    ],
  },
  {
    section: 'Struttura',
    items: [
      ['Titolo 1/2/3', 'Cmd/Ctrl+Alt+1/2/3 oppure # / ## / ###'],
      ['Paragrafo', 'Cmd/Ctrl+Alt+0'],
      ['Citazione', 'Cmd/Ctrl+Shift+B oppure > all\'inizio'],
      ['Linea orizzontale', '--- all\'inizio della riga'],
    ],
  },
  {
    section: 'Liste',
    items: [
      ['Elenco puntato', 'Cmd/Ctrl+Shift+8 oppure - all\'inizio'],
      ['Elenco numerato', 'Cmd/Ctrl+Shift+7 oppure 1. all\'inizio'],
      ['Aumenta indentazione', 'Tab in una lista'],
      ['Diminuisci indentazione', 'Shift+Tab in una lista'],
    ],
  },
  {
    section: 'Modifica',
    items: [
      ['Annulla / Ripeti', 'Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z'],
      ['Link', 'Pulsante in barra strumenti'],
      ['A capo nello stesso paragrafo', 'Shift+Invio'],
    ],
  },
]

function ShortcutsPanel() {
  return (
    <div className="px-4 py-3 border-b border-border bg-secondary/20 text-xs">
      <p className="font-medium text-foreground mb-2">
        Scorciatoie tastiera e Markdown
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        {SHORTCUTS.map((group) => (
          <div key={group.section}>
            <p className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
              {group.section}
            </p>
            <ul className="space-y-1">
              {group.items.map(([label, hint]) => (
                <li key={label} className="flex items-baseline gap-2">
                  <span className="text-foreground flex-shrink-0">{label}:</span>
                  <code className="text-2xs px-1 py-0.5 bg-secondary rounded text-muted-foreground">
                    {hint}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-2xs text-muted-foreground mt-3">
        💡 <strong>Suggerimenti:</strong> Digita Markdown (come `**grassetto**` o `## Titolo`) e verrà
        formattato automaticamente. Oppure <strong>fai clic su un pulsante nella barra e
        inizia a digitare</strong> — il testo verrà formattato finché non disattivi il
        pulsante, proprio come in Word.
      </p>
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
  const [showHelp, setShowHelp] = useState(false)
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
      <Toolbar
        editor={editor}
        showHelp={showHelp}
        onToggleHelp={() => setShowHelp((s) => !s)}
      />
      {showHelp && <ShortcutsPanel />}
      <EditorContent editor={editor} className="bg-background rounded-b-md" />
    </div>
  )
}
