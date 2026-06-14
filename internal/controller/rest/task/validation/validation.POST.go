package validation

import (
	"errors"

	"github.com/sater-151/todo-list/internal/controller/rest/dto"
	"github.com/sater-151/todo-list/internal/entity"
)

func ValidateTaskCreate(taskCreate dto.TaskPOST, boardColumns entity.Columns, userTypes entity.Types) error {
	if taskCreate.Label == "" {
		return errors.New("название задачи не заполнено")
	}

	if len(taskCreate.Label) > 50 {
		return errors.New("название задачи не должно быть длиннее 50 символов")
	}

	if taskCreate.ColumnID != "" {
		columnFound := false
		for _, column := range boardColumns {
			if column.ID == taskCreate.ColumnID {
				columnFound = true
				break
			}
		}
		if !columnFound {
			return errors.New("выбрана некорректная колонка")
		}
	}

	if len(taskCreate.Description) > 300 {
		return errors.New("описание задачи не должно быть длиннее 300 символов")
	}

	if taskCreate.TypeID != "" {
		typeFound := false
		for _, taskType := range userTypes {
			if taskType.ID == taskCreate.TypeID {
				typeFound = true
				break
			}
		}
		if !typeFound {
			return errors.New("выбран некорректный тип задачи")
		}
	}

	return nil
}
