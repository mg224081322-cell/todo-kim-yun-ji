// 화면에서 사용할 요소들을 찾아 둡니다.
const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const list = document.getElementById('todo-list');
const emptyMessage = document.getElementById('empty-message');

// 할 일이 하나도 없으면 안내 문구를 보여 줍니다.
function updateEmptyMessage() {
  emptyMessage.hidden = list.children.length > 0;
}

// 할 일 한 줄(체크박스 + 글자 + 삭제 버튼)을 만들어 목록에 붙입니다.
function addTodo(text) {
  const item = document.createElement('li');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.addEventListener('change', () => {
    item.classList.toggle('done', checkbox.checked);
  });

  const label = document.createElement('span');
  label.textContent = text;

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-button';
  deleteButton.textContent = '삭제';
  deleteButton.addEventListener('click', () => {
    item.remove();
    updateEmptyMessage();
  });

  item.append(checkbox, label, deleteButton);
  list.append(item);
  updateEmptyMessage();
}

// "추가" 버튼을 누르거나 Enter를 치면 실행됩니다.
form.addEventListener('submit', (event) => {
  event.preventDefault(); // 페이지가 새로고침되지 않게 막습니다.

  const text = input.value.trim();
  if (text === '') return;

  addTodo(text);
  input.value = '';
  input.focus();
});

updateEmptyMessage();
