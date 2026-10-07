// Supabase에 접속할 준비를 합니다. (주소와 열쇠는 config.js에 있어요)
const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// 화면에서 사용할 요소들을 찾아 둡니다.
const form = document.getElementById('todo-form');
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

// 할 일 한 줄(체크박스 + 글자 + 삭제 버튼)을 만들어 목록에 붙입니다.
// todo는 Supabase에서 받은 { id, text, done } 모양의 할 일입니다.
function renderTodo(todo) {
  const item = document.createElement('li');
  item.classList.toggle('done', todo.done);

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

  const label = document.createElement('span');
  label.textContent = todo.text;

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

  item.append(checkbox, label, deleteButton);
  list.append(item);
}

// 페이지를 열면 Supabase에서 할 일 목록을 불러옵니다.
async function loadTodos() {
  const { data, error } = await db
    .from('todos')
    .select('id, text, done')
    .order('id'); // 추가한 순서대로 보여 줍니다.

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

  submitButton.disabled = true; // 저장하는 동안 두 번 추가되지 않게 막습니다.

  const { data, error } = await db
    .from('todos')
    .insert({ text })
    .select('id, text, done')
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
  input.focus();
});

loadTodos();
