// Supabase에 접속할 준비를 합니다. (주소와 열쇠는 config.js에 있어요)
const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// 화면에서 사용할 요소들을 찾아 둡니다.
const form = document.getElementById('todo-form');
const authorInput = document.getElementById('author-input');
const dueInput = document.getElementById('due-input');
const input = document.getElementById('todo-input');
const submitButton = form.querySelector('button[type="submit"]');
const list = document.getElementById('todo-list');
const emptyMessage = document.getElementById('empty-message');
const errorMessage = document.getElementById('error-message');
const filterButtons = document.querySelectorAll('.filters button');
const remainingCount = document.getElementById('remaining-count');

// 지금 고른 보기입니다. 'all'(전체), 'active'(진행 중), 'done'(완료) 중 하나예요.
let currentFilter = 'all';

// 보기마다 보여 줄 할 일이 없을 때 띄울 안내 문구입니다.
const emptyTexts = {
  all: '아직 할 일이 없어요.',
  active: '진행 중인 할 일이 없어요.',
  done: '완료한 할 일이 없어요.',
};

// 할 일이 추가·체크·삭제되거나 보기를 바꿀 때마다 화면을 맞춰 줍니다.
// 1) 고른 보기에 맞는 할 일만 보이게 하고
// 2) 보이는 할 일이 없으면 안내 문구를 띄우고
// 3) 남은(완료하지 않은) 할 일 개수를 적습니다.
function updateView() {
  let visibleCount = 0;
  let remaining = 0;

  for (const item of list.children) {
    const done = item.classList.contains('done');
    if (!done) remaining += 1;

    const show = currentFilter === 'all' || (currentFilter === 'done') === done;
    item.hidden = !show;
    if (show) visibleCount += 1;
  }

  emptyMessage.textContent = emptyTexts[currentFilter];
  emptyMessage.hidden = visibleCount > 0;
  remainingCount.textContent = `남은 할 일 ${remaining}개`;
  updateDueWarnings(); // 체크하면 경고가 사라져야 하니 함께 맞춰 줍니다.
}

// 전체·진행 중·완료 버튼을 누르면 보기를 바꿉니다.
for (const button of filterButtons) {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    // 고른 버튼만 '눌린 상태'로 표시합니다. (화면 읽기 프로그램도 이 표시를 읽어요)
    for (const other of filterButtons) {
      other.setAttribute('aria-pressed', other === button);
    }
    updateView();
  });
}

// 오류가 나면 화면에 빨간 상자로 알려 줍니다.
function showError(message, error) {
  errorMessage.textContent = `${message} (${error.message})`;
  errorMessage.hidden = false;
}

// 다음 작업이 성공하면 오류 상자를 숨깁니다.
function clearError() {
  errorMessage.hidden = true;
}

// 두 할 일 중 어느 것이 위에 와야 하는지 정합니다.
// 마감이 가까운 것이 위, 마감이 없는 것은 맨 아래, 마감 시각이 같으면 먼저 추가한 것이 위입니다.
// Date.parse는 마감 시각을 "1970년부터 몇 밀리초가 지났는지" 숫자로 바꿔 줘서 크기를 비교할 수 있어요.
function compareTodos(a, b) {
  const aTime = a.due_at ? Date.parse(a.due_at) : null;
  const bTime = b.due_at ? Date.parse(b.due_at) : null;
  if (aTime === bTime) return a.id - b.id;
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  return aTime - bTime;
}

// 마감 시각을 "10월 15일 오후 6:00까지"처럼 읽기 쉽게 바꿉니다. 올해가 아니면 연도도 붙여요.
function formatDueAt(dueAt) {
  const date = new Date(dueAt);
  const options = { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
  return `${date.toLocaleString('ko-KR', options)}까지`;
}

const ONE_MINUTE = 60 * 1000; // 1분 = 60,000밀리초
const ONE_HOUR = 60 * ONE_MINUTE;

// 지금 시각과 마감 시각을 비교해서 할 일의 상태를 알려 줍니다.
// - 마감이 지났으면 { status: 'overdue' }
// - 마감까지 1시간 이내로 남았으면 { status: 'soon', minutesLeft: 남은 분 }
// - 아직 여유가 있으면 null
function getDueStatus(dueAt, now = Date.now()) {
  const timeLeft = Date.parse(dueAt) - now; // 남은 시간(밀리초). 음수면 이미 지난 거예요.
  if (timeLeft < 0) return { status: 'overdue' };
  if (timeLeft <= ONE_HOUR) return { status: 'soon', minutesLeft: Math.ceil(timeLeft / ONE_MINUTE) };
  return null;
}

// 화면의 할 일마다 마감 상태를 다시 계산해서 표시를 바꿉니다.
// 시간은 계속 흐르니까 아래쪽 setInterval로 1분마다 다시 불러요.
// 이미 완료한 할 일은 경고하지 않아요.
function updateDueWarnings() {
  const now = Date.now();
  for (const item of list.children) {
    const badge = item.querySelector('.due-badge');
    if (!badge) continue; // 마감이 없는 할 일

    const result = item.classList.contains('done') ? null : getDueStatus(item.dataset.dueAt, now);
    item.classList.toggle('urgent', result?.status === 'soon'); // 1시간 이내: 빨갛게 깜빡이는 카드
    item.classList.toggle('overdue', result?.status === 'overdue');

    badge.hidden = !result;
    if (result?.status === 'soon') badge.textContent = `⏰ ${result.minutesLeft}분 남음`;
    if (result?.status === 'overdue') badge.textContent = '마감 지남';
  }
}

// 할 일 한 줄(체크박스 + 글자 + 마감 시각 + 삭제 버튼)을 만들어 목록의 알맞은 자리에 넣습니다.
// todo는 Supabase에서 받은 { id, text, done, author, due_at } 모양의 할 일입니다.
function renderTodo(todo) {
  const item = document.createElement('li');
  item.classList.toggle('done', todo.done);
  // 새 할 일의 자리를 찾거나 마감 경고를 계산할 때 쓰려고 번호와 마감 시각을 적어 둡니다.
  item.dataset.id = todo.id;
  item.dataset.dueAt = todo.due_at ?? '';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = todo.done;
  checkbox.addEventListener('change', async () => {
    const done = checkbox.checked;
    checkbox.disabled = true; // 저장하는 동안 다시 누르지 못하게 막습니다.

    const { data, error } = await db
      .from('todos')
      .update({ done })
      .eq('id', todo.id)
      .select();

    checkbox.disabled = false;
    if (error || data.length === 0) {
      checkbox.checked = !done; // 저장에 실패했으니 체크 상태를 되돌립니다.
      showError('완료 상태를 저장하지 못했어요.', error ?? { message: '바뀐 할 일이 없어요' });
      return;
    }
    clearError();
    item.classList.toggle('done', done);
    updateView(); // 남은 개수가 바뀌고, 고른 보기에 따라 숨겨질 수도 있어요.
  });

  // 할 일 글자를 채웁니다. 이름이 있으면 "윤지: 운동하기"처럼 앞에 붙여요.
  // 글자를 고친 뒤에도 다시 쓰려고 함수로 만들어 둡니다.
  const label = document.createElement('span');
  label.title = '두 번 누르면 고칠 수 있어요';
  function fillLabel() {
    label.replaceChildren(); // 안에 있던 글자를 비웁니다.
    if (todo.author) {
      const author = document.createElement('strong');
      author.className = 'author';
      author.textContent = todo.author;
      label.append(author, ': ');
    }
    label.append(todo.text);
  }
  fillLabel();

  // 글자를 두 번 누르면 그 자리에 입력칸이 나타나 고칠 수 있습니다.
  // Enter는 저장, Esc는 취소예요. 다른 곳을 눌러 입력칸에서 벗어나도 저장합니다.
  label.addEventListener('dblclick', () => {
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'edit-input';
    editInput.value = todo.text;
    label.replaceWith(editInput);
    editInput.focus();
    editInput.select(); // 글자 전체를 골라 둬서 바로 새로 쓸 수도 있게 합니다.

    let finished = false; // Enter와 '벗어나기'가 겹쳐서 두 번 저장되지 않게 막습니다.

    async function finishEditing(save) {
      if (finished) return;
      finished = true;

      const newText = editInput.value.trim();
      // 취소했거나, 글자를 다 지웠거나, 바뀐 게 없으면 원래 글자로 돌아갑니다.
      if (!save || newText === '' || newText === todo.text) {
        editInput.replaceWith(label);
        return;
      }

      editInput.disabled = true; // 저장하는 동안 고치지 못하게 막습니다.

      const { data, error } = await db
        .from('todos')
        .update({ text: newText })
        .eq('id', todo.id)
        .select();

      if (error || data.length === 0) {
        // 고친 글자를 남겨 두고 다시 시도할 수 있게 입력칸을 그대로 둡니다.
        showError('할 일을 고치지 못했어요.', error ?? { message: '바뀐 할 일이 없어요' });
        finished = false;
        editInput.disabled = false;
        editInput.focus();
        return;
      }
      clearError();
      todo.text = newText;
      fillLabel();
      editInput.replaceWith(label);
    }

    editInput.addEventListener('keydown', (event) => {
      // 한글을 조합하는 중에 누른 Enter는 글자를 완성하는 용도라서 무시합니다.
      if (event.isComposing) return;
      if (event.key === 'Enter') finishEditing(true);
      if (event.key === 'Escape') finishEditing(false);
    });
    editInput.addEventListener('blur', () => finishEditing(true));
  });

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-button';
  deleteButton.textContent = '삭제';
  deleteButton.addEventListener('click', async () => {
    deleteButton.disabled = true;

    const { data, error } = await db
      .from('todos')
      .delete()
      .eq('id', todo.id)
      .select();

    if (error || data.length === 0) {
      deleteButton.disabled = false;
      showError('할 일을 삭제하지 못했어요.', error ?? { message: '지워진 할 일이 없어요' });
      return;
    }
    clearError();
    item.remove();
    updateView();
  });

  // 할 일 글자(윗줄)와 마감 시각·경고(아랫줄)를 한 덩어리로 묶습니다.
  // 한 줄에 다 넣으면 좁은 화면에서 할 일 글자가 세로로 찌그러지거든요.
  const body = document.createElement('div');
  body.className = 'todo-body';
  body.append(label);

  if (todo.due_at) {
    const due = document.createElement('time');
    due.className = 'due';
    due.dateTime = todo.due_at;
    due.textContent = formatDueAt(todo.due_at);

    // "⏰ 45분 남음"·"마감 지남" 표시. 평소엔 숨겨 두고 updateDueWarnings가 켜고 끕니다.
    const badge = document.createElement('small');
    badge.className = 'due-badge';
    badge.hidden = true;

    const dueLine = document.createElement('div');
    dueLine.className = 'due-line';
    dueLine.append(due, badge);
    body.append(dueLine);
  }

  item.append(checkbox, body, deleteButton);

  // 이 할 일보다 아래에 와야 하는 첫 번째 줄을 찾아 그 앞에 넣습니다. 없으면 맨 아래에 붙어요.
  const nextItem = [...list.children].find((other) =>
    compareTodos(todo, { id: Number(other.dataset.id), due_at: other.dataset.dueAt || null }) < 0
  );
  list.insertBefore(item, nextItem ?? null);
}

// 페이지를 열면 Supabase에서 할 일 목록을 불러옵니다.
async function loadTodos() {
  const { data, error } = await db
    .from('todos')
    .select('id, text, done, author, due_at')
    // 마감이 가까운 순서로, 마감이 없는 할 일은 맨 아래로 보여 줍니다.
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('id');

  if (error) {
    emptyMessage.hidden = true;
    showError('할 일을 불러오지 못했어요.', error);
    return;
  }
  data.forEach(renderTodo);
  updateView();
}

// "추가" 버튼을 누르거나 Enter를 치면 실행됩니다.
form.addEventListener('submit', async (event) => {
  event.preventDefault(); // 페이지가 새로고침되지 않게 막습니다.

  const text = input.value.trim();
  if (text === '') return;

  // 이름은 안 적어도 됩니다. 비어 있으면 "이름 없음"(null)으로 저장해요.
  const author = authorInput.value.trim() || null;
  // 마감도 안 정해도 됩니다. 비어 있으면 null로 저장해요.
  // 입력칸 값("2026-10-15T18:00")에는 시간대가 없어서, 내 컴퓨터 시간 기준으로 읽은 뒤
  // 세계 표준시(UTC) 글자로 바꿔 보냅니다. 그래야 어느 나라에서 열어도 같은 순간을 가리켜요.
  const due_at = dueInput.value ? new Date(dueInput.value).toISOString() : null;

  submitButton.disabled = true; // 저장하는 동안 두 번 추가되지 않게 막습니다.

  const { data, error } = await db
    .from('todos')
    .insert({ text, author, due_at })
    .select('id, text, done, author, due_at')
    .single();

  submitButton.disabled = false;
  if (error) {
    // 입력한 글자는 지우지 않고 남겨 둬서 다시 시도할 수 있게 합니다.
    showError('할 일을 추가하지 못했어요.', error);
    return;
  }
  clearError();
  renderTodo(data);
  updateView();
  input.value = '';
  dueInput.value = ''; // 마감은 할 일마다 다르니 비웁니다. 이름은 그대로 둬요.
  input.focus();
});

loadTodos();

// 새로고침하지 않아도 1분마다 마감 시간을 다시 확인해서
// 1시간 이내로 들어온 할 일에는 .urgent를 붙이고, 마감이 지나거나 완료한 할 일에서는 뗍니다.
setInterval(updateDueWarnings, ONE_MINUTE);

// 다른 탭을 보고 있으면 브라우저가 타이머를 느리게 돌리기도 해요.
// 그래서 이 탭으로 돌아오는 순간에도 바로 한 번 다시 확인합니다.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateDueWarnings();
});
