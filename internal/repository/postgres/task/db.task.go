package task

import (
	"context"
	"fmt"
	"time"

	"github.com/Masterminds/squirrel"
	"github.com/sater-151/todo-list/internal/entity"
	"github.com/sater-151/todo-list/internal/repository/postgres/models"
	"github.com/sater-151/todo-list/pkg/pgutils"
	"github.com/sater-151/todo-list/pkg/utils"
	"github.com/sirupsen/logrus"
)

func (s *TaskStorage) Get(ctx context.Context, opts entity.GetTasksOpts) (res entity.Tasks, err error) {
	defer utils.AddFuncLabel("[repo-get-tasks]", err)

	query := s.queryBuilder.Select(
		"id",
		"label",
		"column_id",
		"type_id",
		"description",
		"created_at",
		"updated_at",
	).From(fmt.Sprintf("%s.%s AS tasks", s.scheme, TABLE_TASKS))

	query = pgutils.SearchEq(query, "tasks.id", opts.ID)
	query = pgutils.SearchEq(query, "tasks.column_id", opts.ColumnID)
	query = pgutils.SearchEq(query, "tasks.type_id", opts.TypeID)
	query = pgutils.SearchMultiEq(query, "tasks.column_id", opts.ColumnIDs)
	query = query.OrderBy("tasks.created_at ASC", "tasks.id ASC")

	sql, args, err := query.ToSql()

	logrus.Debugf("\n [get-tasks: INCOMING] \n OPTS: %+v \n", opts)
	logrus.Debugf("\n [get-tasks: SQL] \n Query: %s \n ARGS: %v \n", sql, args)

	if err != nil {
		return nil, err
	}

	rows, err := s.client.Query(ctx, sql, args...)
	defer rows.Close()

	for rows.Next() {
		t := models.Task{}

		scanValues := []any{
			&t.ID,
			&t.Label,
			&t.ColumnID,
			&t.TypeID,
			&t.Description,
			&t.CreatedAt,
			&t.UpdatedAt,
		}

		if err = rows.Scan(scanValues...); err != nil {
			return nil, err
		}

		taskEntity := t.ToEntity()

		res = append(res, taskEntity)
	}

	return
}

func (s *TaskStorage) Create(ctx context.Context, task entity.TaskCreate) (res string, err error) {
	defer utils.AddFuncLabel("[repo-create-task]", err)

	sql, args, err := s.queryBuilder.
		Insert(fmt.Sprintf("%s.%s", s.scheme, TABLE_TASKS)).
		Columns(
			"type_id",
			"column_id",
			"label",
			"description",
			"created_at",
			"updated_at",
		).Values(
		task.TypeID,
		task.ColumnID,
		task.Label,
		task.Description,
		time.Now(),
		time.Now(),
	).
		Suffix("RETURNING id").
		ToSql()

	logrus.Debugf("\n [create-task: INCOMING] \n task-create: %+v \n", task)
	logrus.Debugf("\n [create-task: SQL] \n Query: %s \n ARGS: %v \n", sql, args)

	if err != nil {
		return
	}

	err = s.client.QueryRow(ctx, sql, args...).Scan(&res)

	return
}

func (s *TaskStorage) Update(ctx context.Context, task entity.TaskUpdate) (err error) {
	defer utils.AddFuncLabel("[repo-update-task]", err)

	query := s.queryBuilder.
		Update(fmt.Sprintf("%s.%s", s.scheme, TABLE_TASKS)).
		Where(squirrel.Eq{"id": task.ID})

	if task.TypeID != nil {
		query = query.Set("type_id", *task.TypeID)
	}

	if task.ColumnID != nil {
		query = query.Set("column_id", *task.ColumnID)
	}

	if task.Label != nil {
		query = query.Set("label", *task.Label)
	}

	if task.Description != nil {
		query = query.Set("description", *task.Description)
	}

	query = query.Set("updated_at", time.Now())

	sql, args, err := query.ToSql()

	logrus.Debugf("\n [update-task: INCOMING] \n task-update: %+v \n", task)
	logrus.Debugf("\n [update-task: SQL] \n Query: %s \n ARGS: %v \n", sql, args)

	if err != nil {
		return
	}

	_, err = s.client.Exec(ctx, sql, args...)

	return
}

func (s *TaskStorage) Delete(ctx context.Context, taskID string) (err error) {
	defer utils.AddFuncLabel("[repo-delete-task]", err)

	sql, args, err := s.queryBuilder.
		Delete(fmt.Sprintf("%s.%s", s.scheme, TABLE_TASKS)).
		Where(squirrel.Eq{"id": taskID}).
		ToSql()

	logrus.Debugf("\n [delete-task: INCOMING] \n task-id: %s \n", taskID)
	logrus.Debugf("\n [delete-task: SQL] \n Query: %s \n ARGS: %v \n", sql, args)

	if err != nil {
		return
	}

	_, err = s.client.Exec(ctx, sql, args...)

	return
}
