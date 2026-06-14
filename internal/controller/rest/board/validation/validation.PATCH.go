package validation

import (
	"fmt"

	"github.com/sater-151/todo-list/internal/controller/rest/dto"
	"github.com/sater-151/todo-list/internal/entity"
)

func ValidateBoardUpdate(boardCreate dto.BoardPATCH, boards entity.Boards) error {
	if boardCreate.Name != nil {
		name := *boardCreate.Name

		if name == "" {
			return fmt.Errorf("название доски не заполнено")
		}

		if len(name) > 50 {
			return fmt.Errorf("название доски не должно быть длиннее 50 символов")
		}

		for _, board := range boards {
			if board.Name == name {
				return fmt.Errorf("доска с названием %s уже существует", name)
			}
		}
	}

	return nil
}
