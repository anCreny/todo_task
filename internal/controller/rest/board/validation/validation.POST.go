package validation

import (
	"fmt"

	"github.com/sater-151/todo-list/internal/controller/rest/dto"
)

func ValidateBoardCreate(boardCreate dto.BoardPOST) error {
	name := boardCreate.Name

	if name == "" {
		return fmt.Errorf("название доски не заполнено")
	}

	if len(name) > 50 {
		return fmt.Errorf("название доски не должно быть длиннее 50 символов")
	}

	return nil
}
