package validation

import (
	"fmt"

	"github.com/sater-151/todo-list/internal/controller/rest/dto"
	"github.com/sater-151/todo-list/internal/entity"
	"github.com/sater-151/todo-list/pkg/utils"
)

func ValidateColumnUpdate(allBoardColumns entity.Columns, newColumn dto.ColumnPATCH) error {
	if newColumn.Name != nil {
		name := *newColumn.Name
		if name == "" {
			return fmt.Errorf("название колонки не заполнено")
		}

		nameGroup := utils.NameGroup(allBoardColumns)
		if _, ok := nameGroup[name]; ok {
			return fmt.Errorf("колонка с названием %s уже существует", name)
		}
	}

	if newColumn.OrderNumber != nil {
		orderNumber := *newColumn.OrderNumber
		if orderNumber <= 0 && orderNumber != -1 {
			return fmt.Errorf("порядок колонки должен быть больше 0")
		}

		orderNumberGroup := utils.OrderNumberGroup(allBoardColumns)
		if _, ok := orderNumberGroup[orderNumber]; ok {
			return fmt.Errorf("колонка с порядком %d уже существует", orderNumber)
		}
	}

	return nil
}
