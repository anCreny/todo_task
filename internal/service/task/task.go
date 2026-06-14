package task

import (
	"context"
	"fmt"
	"slices"

	"github.com/sater-151/todo-list/internal/entity"
	"github.com/sater-151/todo-list/pkg/utils"
)

type TaskService struct {
	boards     BoardRepository
	columns    ColumnRepository
	types      TypeRepository
	tasks      Repository
	moveEvents MoveEventRepository
}

func (s *TaskService) Get(ctx context.Context, boardID string, opts entity.GetTasksOpts) (tasks entity.Tasks, err error) {
	columns, err := s.columns.GetColumns(ctx, entity.GetColumnsOpts{BoardID: boardID})
	if err != nil {
		return
	}

	if len(columns) == 0 {
		return nil, fmt.Errorf("некорректная доска: %s", boardID)
	}

	columnIDs := columns.GetIDs()

	opts.ColumnIDs = append(opts.ColumnIDs, columnIDs...)

	tasks, err = s.tasks.Get(ctx, opts)
	if err != nil {
		return
	}

	if len(tasks) == 0 {
		return nil, entity.ErrNotFound
	}

	return
}

func (s *TaskService) GetByID(ctx context.Context, boardID, taskID string) (res entity.Task, err error) {
	columns, err := s.columns.GetColumns(ctx, entity.GetColumnsOpts{BoardID: boardID})
	if err != nil {
		return
	}

	if len(columns) == 0 {
		return entity.Task{}, fmt.Errorf("некорректная доска: %s", boardID)
	}

	IDs := columns.GetIDs()

	tasks, err := s.Get(ctx, boardID, entity.GetTasksOpts{ID: taskID, ColumnIDs: IDs})
	if err != nil {
		return
	}

	return tasks[0], nil
}

func (s *TaskService) GetByColumnID(ctx context.Context, boardID, columnID string) (res entity.Tasks, err error) {
	columns, err := s.columns.GetColumns(ctx, entity.GetColumnsOpts{BoardID: boardID})
	if err != nil {
		return
	}

	if len(columns) == 0 {
		return nil, fmt.Errorf("некорректная доска: %s", boardID)
	}

	IDs := columns.GetIDs()

	if !slices.Contains(IDs, columnID) {
		return nil, fmt.Errorf("некорректная колонка: %s", columnID)
	}

	tasks, err := s.Get(ctx, boardID, entity.GetTasksOpts{ColumnID: columnID})
	if err != nil {
		return
	}

	return tasks, nil
}

func (s *TaskService) GetByTypeID(ctx context.Context, boardID, typeID string) (res entity.Tasks, err error) {
	users, err := s.Get(ctx, boardID, entity.GetTasksOpts{TypeID: typeID})
	if err != nil {
		return
	}

	return users, nil
}

func (s *TaskService) GetByBoardID(ctx context.Context, boardID string) (res entity.Tasks, err error) {
	columns, err := s.columns.GetColumns(ctx, entity.GetColumnsOpts{BoardID: boardID})
	if err != nil {
		return
	}

	if len(columns) == 0 {
		return nil, fmt.Errorf("некорректная доска: %s", boardID)
	}

	columnIDs := columns.GetIDs()

	tasks, err := s.Get(ctx, boardID, entity.GetTasksOpts{ColumnIDs: columnIDs})
	if err != nil {
		return
	}

	return tasks, err
}

func (s *TaskService) Create(ctx context.Context, boardID string, taskCreate entity.TaskCreate) (res entity.Task, err error) {
	defer utils.AddFuncLabel("[service-create-task]", err)

	boards, err := s.boards.Get(ctx, entity.GetBoardsOpts{ID: boardID})
	if err != nil {
		return
	}

	if len(boards) == 0 {
		return entity.Task{}, entity.ErrNotFound
	}

	board := boards[0]

	if taskCreate.ColumnID == "" {
		columns, err := s.columns.GetColumns(ctx, entity.GetColumnsOpts{BoardID: boardID, Name: "backlog"})
		if err != nil {
			return entity.Task{}, err
		}

		if len(columns) == 0 {
			return entity.Task{}, entity.ErrNotFound
		}

		backlogColumn := columns[0]

		taskCreate.ColumnID = backlogColumn.ID
	}

	if taskCreate.TypeID == "" {
		types, err := s.types.Get(ctx, entity.GetTypesOpts{UserID: board.UserID, Name: "null"})
		if err != nil {
			return entity.Task{}, err
		}

		if len(types) == 0 {
			return entity.Task{}, entity.ErrNotFound
		}

		taskCreate.TypeID = types[0].ID
	}

	newTypeID, err := s.tasks.Create(ctx, taskCreate)
	if err != nil {
		return
	}

	return s.GetByID(ctx, boardID, newTypeID)
}

func (s *TaskService) Update(ctx context.Context, boardID string, taskUpdate entity.TaskUpdate) (res entity.Task, err error) {
	defer utils.AddFuncLabel("[service-update-task]", err)

	_, err = s.GetByID(ctx, boardID, taskUpdate.ID)
	if err != nil {
		return
	}

	if err = s.tasks.Update(ctx, taskUpdate); err != nil {
		return
	}

	return s.GetByID(ctx, boardID, taskUpdate.ID)
}

func (s *TaskService) Delete(ctx context.Context, taskID string) (err error) {
	defer utils.AddFuncLabel("[service-delete-task]", err)

	return s.tasks.Delete(ctx, taskID)
}

func (s *TaskService) Move(ctx context.Context, boardID, taskID, newColumnID string) (res entity.Task, err error) {
	defer utils.AddFuncLabel("[service-move-task]", err)

	columns, err := s.columns.GetColumns(ctx, entity.GetColumnsOpts{BoardID: boardID, ID: newColumnID})
	if err != nil {
		return
	}

	if len(columns) == 0 {
		return entity.Task{}, fmt.Errorf("некорректная колонка: %s", newColumnID)
	}

	task, err := s.GetByID(ctx, boardID, taskID)
	if err != nil {
		return
	}

	moveEventCreate := entity.MoveEventCreate{
		TaskID:       taskID,
		ToColumnID:   newColumnID,
		FromColumnID: task.ColumnID,
	}

	if err = s.moveEvents.Create(ctx, moveEventCreate); err != nil {
		return
	}

	taskUpdate := entity.TaskUpdate{
		ID:       taskID,
		ColumnID: &newColumnID,
	}

	if err = s.tasks.Update(ctx, taskUpdate); err != nil {
		return
	}

	movedTask, err := s.GetByID(ctx, boardID, taskID)
	if err != nil {
		return
	}

	return movedTask, nil
}
