import { ref } from 'vue'

export function useDragDrop<T extends { id: string; order: number }>(items: T[]) {
  const list = ref<T[]>([...items]) as ReturnType<typeof ref<T[]>>
  const draggingId = ref<string | null>(null)

  function onDragStart(id: string) {
    draggingId.value = id
  }

  function onDragEnd() {
    draggingId.value = null
  }

  function onDrop(targetId: string) {
    if (!draggingId.value || draggingId.value === targetId) return

    const arr = list.value as T[]
    const fromIdx = arr.findIndex((item) => item.id === draggingId.value)
    const toIdx = arr.findIndex((item) => item.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...arr]
    const moved = reordered.splice(fromIdx, 1)[0]
    if (!moved) return
    reordered.splice(toIdx, 0, moved)
    reordered.forEach((item, i) => (item.order = i))
    list.value = reordered
    draggingId.value = null
  }

  function setItems(newItems: T[]) {
    list.value = [...newItems]
  }

  return { list, draggingId, onDragStart, onDragEnd, onDrop, setItems }
}
