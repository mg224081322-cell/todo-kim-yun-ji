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

// 할 일이 하나도 없으면 안내 문구를 보여 줍니다.
function updateEmptyMessage() {
  emptyMessage.hidden = list.children.length > 0;
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
// 마감이 가까운 것이 위, 마감일이 없는 것은 맨 아래, 마감일이 같으면 먼저 추가한 것이 위입니다.
// 마감일은 "2026-10-15" 같은 글자라서 글자끼리 비교해도 날짜 순서와 같아요.
function compareTodos(a, b) {
  if (a.due_date === b.due_date) return a.id - b.id;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date < b.due_date ? -1 : 1;
}

// "2026-10-15"를 "10월 15일까지"처럼 읽기 쉽게 바꿉니다. 올해가 아니면 연도도 붙여요.
function formatDueDate(dueDate) {
  const [year, month, day] = dueDate.split('-').map(Number);
  const yearText = year === new Date().getFullYear() ? '' : `${year}년 `;
  return `${yearText}${month}월 ${day}일까지`;
}

// 할 일 한 줄(체크박스 + 글자 + 마감일 + 삭제 버튼)을 만들어 목록의 알맞은 자리에 넣습니다.
// todo는 Supabase에서 받은 { id, text, done, author, due_date } 모양의 할 일입니다.
function renderTodo(todo) {
  const item = document.createElement('li');
  item.classList.toggle('done', todo.done);
  // 나중에 새 할 일의 자리를 찾을 때 쓰려고 번호와 마감일을 적어 둡니다.
  item.dataset.id = todo.id;
  item.dataset.dueDate = todo.due_date ?? '';

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
  });

  // 이름이 있으면 "윤지: 운동하기"처럼 할 일 앞에 붙입니다.
  const label = document.createElement('span');
  if (todo.author) {
    const author = document.createElement('strong');
    author.className = 'author';
    author.textContent = todo.author;
    label.append(author, ': ');
  }
  label.append(todo.text);

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
    updateEmptyMessage();
  });

  item.append(checkbox, label);

  if (todo.due_date) {
    const due = document.createElement('time');
    due.className = 'due';
    due.dateTime = todo.due_date;
    due.textContent = formatDueDate(todo.due_date);
    item.append(due);
  }

  item.append(deleteButton);

  // 이 할 일보다 아래에 와야 하는 첫 번째 줄을 찾아 그 앞에 넣습니다. 없으면 맨 아래에 붙어요.
  const nextItem = [...list.children].find((other) =>
    compareTodos(todo, { id: Number(other.dataset.id), due_date: other.dataset.dueDate || null }) < 0
  );
  list.insertBefore(item, nextItem ?? null);
}

// 페이지를 열면 Supabase에서 할 일 목록을 불러옵니다.
async function loadTodos() {
  const { data, error } = await db
    .from('todos')
    .select('id, text, done, author, due_date')
    // 마감이 가까운 순서로, 마감일이 없는 할 일은 맨 아래로 보여 줍니다.
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('id');

  emptyMessage.textContent = '아직 할 일이 없어요.';
  if (error) {
    emptyMessage.hidden = true;
    showError('할 일을 불러오지 못했어요.', error);
    return;
  }
  data.forEach(renderTodo);
  updateEmptyMessage();
}

// "추가" 버튼을 누르거나 Enter를 치면 실행됩니다.
form.addEventListener('submit', async (event) => {
  event.preventDefault(); // 페이지가 새로고침되지 않게 막습니다.

  const text = input.value.trim();
  if (text === '') return;

  // 이름은 안 적어도 됩니다. 비어 있으면 "이름 없음"(null)으로 저장해요.
  const author = authorInput.value.trim() || null;
  // 마감일도 안 정해도 됩니다. 비어 있으면 null로 저장해요.
  const due_date = dueInput.value || null;

  submitButton.disabled = true; // 저장하는 동안 두 번 추가되지 않게 막습니다.

  const { data, error } = await db
    .from('todos')
    .insert({ text, author, due_date })
    .select('id, text, done, author, due_date')
    .single();

  submitButton.disabled = false;
  if (error) {
    // 입력한 글자는 지우지 않고 남겨 둬서 다시 시도할 수 있게 합니다.
    showError('할 일을 추가하지 못했어요.', error);
    return;
  }
  clearError();
  renderTodo(data);
  updateEmptyMessage();
  input.value = '';
  dueInput.value = ''; // 마감일은 할 일마다 다르니 비웁니다. 이름은 그대로 둬요.
  input.focus();
});

loadTodos();
