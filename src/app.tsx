import { CraftTextBlock, TodoListStyle } from "@craftdocs/craft-extension-api";

import {
  ChakraProvider,
  Checkbox,
  Heading,
  Img,
  Button,
  Flex,
  Text,
  useToast,
  Switch,
  useColorMode,
} from "@chakra-ui/react";
import { CheckCircleIcon, RepeatIcon } from "@chakra-ui/icons";
import * as React from "react";
import * as ReactDOM from "react-dom";
import finishEmIcon from "./finish-em.png";
import { v4 as uuid } from "uuid";
import theme from "./theme/index";

type Todo = {
  id: string;
  text: string;
  checked: boolean;
};

const App: React.FC<{}> = () => {
  const isDarkMode = useCraftDarkMode();
  const { colorMode, toggleColorMode } = useColorMode();
  const toast = useToast();
  const [todos, setTodos] = React.useState<Todo[]>([]);
  const [debug, setDebug] = React.useState<boolean>(false);
  const [fetchingTodos, setFetchingTodos] = React.useState<boolean>(false);
  const [sendingTodos, setSendingTodos] = React.useState<boolean>(false);
  const [hasSubmitted, setHasSubmitted] = React.useState<boolean>(false);
  const [debugInfo, setDebugInfo] = React.useState<string>();

  if (
    (isDarkMode && colorMode == "light") ||
    (!isDarkMode && colorMode == "dark")
  ) {
    toggleColorMode();
  }

  const log = (input: string | object) => {
    if (!debug) return;
    setDebugInfo(debugInfo + "\n" + JSON.stringify(input));
    return;
  };

  const updateTodosInCraft = async (todos: Todo[]) => {
    log(todos);
    const blockIdsToEdit = todos.filter((t) => t.checked).map((t) => t.id);
    log(blockIdsToEdit);
    const selectionResult = await craft.editorApi.selectBlocks(blockIdsToEdit);
    log(selectionResult);

    if (selectionResult.status !== "success") {
      throw new Error(selectionResult.message);
    }
    if (!selectionResult.data) {
      return;
    }

    const selectedBlocks = selectionResult.data;
    log(selectedBlocks);
    selectedBlocks.forEach(async (block) => {
      if (block.type != "textBlock" || block.listStyle.type != "todo") {
        log("failed to find a todo block");
        throw new Error("Tried to alter a non-todo");
      }

      block.content.map((t) => (t.text = "cat"));
      //      block.listStyle.state = "checked";
      const result = await craft.dataApi.updateBlocks([block]);
      log(result);

      if (result.status !== "success") {
        throw new Error(result.message);
      }

      if (!result.data) {
        throw new Error("Failed to update anything");
      }
    });
  };

  const sendTodosToFinishEm = async (todos: Todo[]) => {
    setSendingTodos(true);
    await Promise.all(
      todos.map(async (t) => {
        const result = await fetch("http://localhost:8089/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `
  mutation CreateItem(
    $key: String!
    $type: String!
    $text: String!
  ) {
    createItem(
      input: {
        key: $key
        type: $type
        text: $text
      }
    ) {
      key
      type
      text
      project {
        key
      }
    }
  }
      `,
            variables: {
              key: uuid(),
              type: "TODO",
              text: t.text,
            },
          }),
        });
        if (!result.ok) {
          setSendingTodos(false);
          throw new Error(
            `Failed to send todos to Finish Em - ${result.statusText}`
          );
        }
        return result;
      })
    );
    toast({
      position: "bottom-right",
      title: `${todos.length} todos sent`,
      status: "success",
      variant: "subtle",
      isClosable: true,
    });
    setSendingTodos(false);
  };

  const getTodosInText = async () => {
    setFetchingTodos(true);
    const result = await craft.dataApi.getCurrentPage();
    if (result.status !== "success") {
      setFetchingTodos(false);
      throw new Error(result.message);
    }

    const pageBlock = result.data;

    const todoBlocks = pageBlock.subblocks.filter(
      (sb) => sb.type == "textBlock" && sb.listStyle.type == "todo"
    ) as CraftTextBlock[];

    const foundTodos = todoBlocks
      .filter((t) => {
        const listStyle = t.listStyle as TodoListStyle;
        return listStyle.state != "checked";
      })
      .map((t: CraftTextBlock) => {
        return {
          id: t.id,
          text: t.content.map((z) => z.text).join(","),
          checked: true,
        };
      });

    if (foundTodos.length == 0) {
      toast({
        position: "bottom-right",
        title: `No todos found`,
        status: "info",
        variant: "subtle",
        isClosable: true,
      });
    }

    setTodos(foundTodos);
    setFetchingTodos(false);
  };

  return (
    <Flex direction={"column"} w="100%" maxW="280px" py={6} px={2}>
      <Flex py={4} alignItems="center" justifyContent="start">
        <Img
          height="32px"
          width="32px"
          src={finishEmIcon}
          alt="Finish Em Icon"
        />
        <Heading size="15px" pl={2}>
          {"Send to Finish Em"}
        </Heading>
      </Flex>
      <Flex direction="column">
        {!hasSubmitted && (
          <Flex justifyContent="start">
            {Object.keys(todos).length == 0 ? (
              <Text my={4} fontSize="md" color="gray.400">
                No todos found in this document
              </Text>
            ) : (
              <Flex w="100%" direction="column" mr={2}>
                {todos.map((t, idx) => (
                  <Flex
                    shadow="md"
                    border={"1px solid"}
                    borderColor={colorMode == "light" ? "gray.200" : "gray.600"}
                    bg={colorMode == "light" ? "white" : "gray.800"}
                    alignItems="center"
                    p={2}
                    borderRadius="md"
                    w="100%"
                    m={1}
                    mx={2}
                  >
                    <Checkbox
                      colorScheme="blue"
                      defaultChecked
                      value={t.id}
                      checked={t.checked}
                      mx={2}
                      onChange={(e) => {
                        const tempTodos = [...todos];
                        const newTodo = { ...t };
                        newTodo.checked = e.target.checked;
                        // TODO: This seems a bit wrong
                        tempTodos[idx] = newTodo;
                        setTodos(tempTodos);
                      }}
                    />
                    <Text fontSize="md"> {t.text} </Text>
                  </Flex>
                ))}
              </Flex>
            )}
          </Flex>
        )}

        <Flex w="100%" justifyContent="space-between" pt={4}>
          <Button
            isLoading={fetchingTodos}
            size="sm"
            fontSize="md"
            aria-label="refresh"
            leftIcon={<RepeatIcon />}
            onClick={() => {
              setHasSubmitted(false);
              getTodosInText();
            }}
          >
            Get Todos
          </Button>

          <Button
            isDisabled={todos.findIndex((t) => t.checked) < 0 || hasSubmitted}
            leftIcon={hasSubmitted ? <CheckCircleIcon /> : undefined}
            colorScheme={hasSubmitted ? "green" : "blue"}
            isLoading={sendingTodos}
            fontSize="md"
            size="sm"
            onClick={async () => {
              await updateTodosInCraft(todos);
              await sendTodosToFinishEm(todos);
              setHasSubmitted(true);
            }}
          >
            {hasSubmitted ? "Done" : "Submit"}
          </Button>
        </Flex>
      </Flex>
      <Flex my={4} alignItems="center">
        <Text fontSize="9px" pr={2}>
          {"Enable debug"}
        </Text>
        <Switch
          size="sm"
          isChecked={debug}
          onChange={(e) => setDebug(e.target.checked)}
        />
      </Flex>

      {debug && (
        <Flex direction="column" mt={2} justifyContent="center">
          <Text fontSize="xs">{debugInfo}</Text>
          <Button my={2} maxW="80px" size="sm" onClick={() => setDebugInfo("")}>
            Clear log
          </Button>
        </Flex>
      )}
    </Flex>
  );
};

const useCraftDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  React.useEffect(() => {
    craft.env.setListener((env) => setIsDarkMode(env.colorScheme === "dark"));
  }, []);

  return isDarkMode;
};
export function initApp() {
  ReactDOM.render(
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>,
    document.getElementById("react-root")
  );
}
