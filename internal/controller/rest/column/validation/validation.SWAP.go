package validation

import (
	"fmt"

	"github.com/sater-151/todo-list/internal/entity"
)

func ValidateColumnSwap(columnA entity.Column, columnB entity.Column) error {
	if columnA.ID == columnB.ID {
		return fmt.Errorf("нельзя поменять колонку саму с собой")
	}

	return nil
}
