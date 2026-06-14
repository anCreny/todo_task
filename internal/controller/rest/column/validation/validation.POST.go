package validation

import (
	"fmt"

	"github.com/sater-151/todo-list/internal/controller/rest/dto"
	"github.com/sater-151/todo-list/internal/entity"
	"github.com/sater-151/todo-list/pkg/utils"
)

func ValidateColumnCreate(allBoardColumns entity.Columns, newColumn dto.ColumnPOST) error {
	if newColumn.Name == "" {
		return fmt.Errorf("название колонки не заполнено")
	}

	nameGroup := utils.NameGroup(allBoardColumns)
	if _, ok := nameGroup[newColumn.Name]; ok {
		return fmt.Errorf("колонка с названием %s уже существует", newColumn.Name)
	}

	if newColumn.OrderNumber <= 0 && newColumn.OrderNumber != -1 {
		return fmt.Errorf("порядок колонки должен быть больше 0")
	}

	orderNumberGroup := utils.OrderNumberGroup(allBoardColumns)
	if _, ok := orderNumberGroup[newColumn.OrderNumber]; ok {
		return fmt.Errorf("колонка с порядком %d уже существует", newColumn.OrderNumber)
	}

	return nil
}
