import test from 'brittle'
import { parseNetscapeBookmarks } from '../src/import/netscape.ts'

const emptyRoot = () => ({ name: '', folders: [], bookmarks: [] })

test('empty HTML or HTML without DL returns an empty root', (t) => {
  t.alike(parseNetscapeBookmarks(''), emptyRoot())
  t.alike(parseNetscapeBookmarks('<html><body><a href="https://example.com">Example</a></body></html>'), emptyRoot())
})

test('parses a bookmark directly in the root', (t) => {
  t.alike(parseNetscapeBookmarks('<DL><p><DT><A HREF="https://example.com">Example</A></DL>'), {
    name: '',
    folders: [],
    bookmarks: [{ url: 'https://example.com', title: 'Example' }]
  })
})

test('parses a first-level folder and its bookmark', (t) => {
  t.alike(parseNetscapeBookmarks('<DL><p><DT><H3>Reading</H3><DL><p><DT><A HREF="https://example.com">Example</A></DL></DL>'), {
    name: '',
    folders: [{ name: 'Reading', folders: [], bookmarks: [{ url: 'https://example.com', title: 'Example' }] }],
    bookmarks: []
  })
})

test('preserves two levels of nested folders', (t) => {
  t.alike(parseNetscapeBookmarks('<DL><DT><H3>Reading</H3><DL><DT><H3>History</H3><DL><DT><A HREF="https://example.com">Example</A></DL></DL></DL>'), {
    name: '',
    folders: [{
      name: 'Reading',
      folders: [{ name: 'History', folders: [], bookmarks: [{ url: 'https://example.com', title: 'Example' }] }],
      bookmarks: []
    }],
    bookmarks: []
  })
})

test('promotes children of Bookmarks Bar to the root', (t) => {
  t.alike(parseNetscapeBookmarks('<DL><DT><H3>Bookmarks Bar</H3><DL><DT><H3>Work</H3><DL><DT><A HREF="https://work.example">Work</A></DL></DL><DT><A HREF="https://loose.example">Loose</A></DL></DL>'), {
    name: '',
    folders: [{ name: 'Work', folders: [], bookmarks: [{ url: 'https://work.example', title: 'Work' }] }],
    bookmarks: [{ url: 'https://loose.example', title: 'Loose' }]
  })
})

test('promotes children of Favoritos to the root case-insensitively', (t) => {
  t.alike(parseNetscapeBookmarks('<DL><DT><H3>fAvOrItOs</H3><DL><DT><H3>Personal</H3><DL><DT><A HREF="https://personal.example">Personal</A></DL></DL></DL>'), {
    name: '',
    folders: [{ name: 'Personal', folders: [], bookmarks: [{ url: 'https://personal.example', title: 'Personal' }] }],
    bookmarks: []
  })
})


test('promotes children of Barra de herramientas de marcadores to the root', (t) => {
  t.alike(parseNetscapeBookmarks('<DL><DT><H3>Barra de herramientas de marcadores</H3><DL><DT><H3>Trabajo</H3><DL><DT><A HREF="https://work.example">Trabajo</A></DL><DT><A HREF="https://loose.example">Suelto</A></DL></DL>'), {
    name: '',
    folders: [{ name: 'Trabajo', folders: [], bookmarks: [{ url: 'https://work.example', title: 'Trabajo' }] }],
    bookmarks: [{ url: 'https://loose.example', title: 'Suelto' }]
  })
})

test('promotes children of Barra de marcadores to the root case-insensitively', (t) => {
  t.alike(parseNetscapeBookmarks('<DL><DT><H3>bArRa De MaRcAdOrEs</H3><DL><DT><H3>Personal</H3><DL><DT><A HREF="https://personal.example">Personal</A></DL></DL></DL>'), {
    name: '',
    folders: [{ name: 'Personal', folders: [], bookmarks: [{ url: 'https://personal.example', title: 'Personal' }] }],
    bookmarks: []
  })
})

test('ignores empty folders', (t) => {
  t.alike(parseNetscapeBookmarks('<DL><DT><H3>Empty</H3><DL></DL></DL>'), emptyRoot())
})

test('ignores anchors without HREF or with an empty HREF', (t) => {
  t.alike(parseNetscapeBookmarks('<DL><DT><A>No URL</A><DT><A HREF="">Empty URL</A></DL>'), emptyRoot())
})

test('omits title when anchor text is empty or whitespace', (t) => {
  const parsed = parseNetscapeBookmarks('<DL><DT><A HREF="https://example.com">   </A></DL>')
  t.alike(parsed, { name: '', folders: [], bookmarks: [{ url: 'https://example.com' }] })
  t.ok(!Object.prototype.hasOwnProperty.call(parsed.bookmarks[0], 'title'))
})

test('extracts integer ADD_DATE as seconds since epoch', (t) => {
  t.alike(parseNetscapeBookmarks('<DL><DT><A HREF="https://example.com" ADD_DATE="1700000000">Example</A></DL>'), {
    name: '',
    folders: [],
    bookmarks: [{ url: 'https://example.com', title: 'Example', addDate: 1700000000 }]
  })
})

test('decodes basic HTML entities in titles and URLs', (t) => {
  t.alike(parseNetscapeBookmarks('<DL><DT><A HREF="https://example.com/?a=1&amp;b=2">A &amp; B &lt;ok&gt; &quot;yes&quot; &#39;fine&#39; &apos;done&apos;</A></DL>'), {
    name: '',
    folders: [],
    bookmarks: [{
      url: 'https://example.com/?a=1&b=2',
      title: 'A & B <ok> "yes" \'fine\' \'done\''
    }]
  })
})

test('malformed HTML without a closing DL still returns parsed content', (t) => {
  t.alike(parseNetscapeBookmarks('<DL><DT><H3>Reading</H3><DL><DT><A HREF="https://example.com">Example</A>'), {
    name: '',
    folders: [{ name: 'Reading', folders: [], bookmarks: [{ url: 'https://example.com', title: 'Example' }] }],
    bookmarks: []
  })
})

test('parses a realistic small browser export', (t) => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
    <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
    <TITLE>Bookmarks</TITLE>
    <H1>Bookmarks</H1>
    <DL><p>
      <DT><H3 ADD_DATE="1700000000">Bookmarks Toolbar</H3>
      <DL><p>
        <DT><H3>Development</H3>
        <DL><p>
          <DT><A HREF="https://developer.mozilla.org/" ADD_DATE="1700000001">MDN</A>
          <DT><A HREF="https://example.com/?a=1&amp;b=2">Example &amp; docs</A>
        </DL><p>
        <DT><H3>Reading</H3>
        <DL><p>
          <DT><A HREF="https://example.org/">Article</A>
        </DL><p>
      </DL><p>
    </DL>`
  t.alike(parseNetscapeBookmarks(html), {
    name: '',
    folders: [
      {
        name: 'Development',
        folders: [],
        bookmarks: [
          { url: 'https://developer.mozilla.org/', title: 'MDN', addDate: 1700000001 },
          { url: 'https://example.com/?a=1&b=2', title: 'Example & docs' }
        ]
      },
      {
        name: 'Reading',
        folders: [],
        bookmarks: [{ url: 'https://example.org/', title: 'Article' }]
      }
    ],
    bookmarks: []
  })
})
