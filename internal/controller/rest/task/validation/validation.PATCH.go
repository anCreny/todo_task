package validation

import (
	"errors"
	"slices"

	"github.com/sater-151/todo-list/internal/controller/rest/dto"
)

func ValidateTaskUpdate(taskUpdate dto.TaskPATCH, validTypeIDs []string) error {
	if taskUpdate.Label != nil {
		label := *taskUpdate.Label
		if len(label) > 50 {
			return errors.New("название задачи не должно быть длиннее 50 символов")
		}

		if label == "" {
			return errors.New("название задачи не заполнено")
		}
	}

	if taskUpdate.Description != nil {
		description := *taskUpdate.Description
		if len(description) > 300 {
			return errors.New("описание задачи не должно быть длиннее 300 символов")
		}
	}

	if taskUpdate.TypeID != nil && len(validTypeIDs) > 0 {
		if slices.Contains(validTypeIDs, *taskUpdate.TypeID) {
			return nil
		}
		return errors.New("выбран некорректный тип задачи")
	}

	return nil
}
