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
  const [fetchingTodos, setFetchingTodos] = React.useState<boolean>(false);
  const [sendingTodos, setSendingTodos] = React.useState<boolean>(false);
  const [hasSubmitted, setHasSubmitted] = React.useState<boolean>(false);

  if (
    (isDarkMode && colorMode == "light") ||
    (!isDarkMode && colorMode == "dark")
  ) {
    toggleColorMode();
  }

  const updateTodosInCraft = async (todos: Todo[]): Promise<boolean> => {
    const blockIdsToEdit = todos.filter((t) => t.checked).map((t) => t.id);
    const selectionResult = await craft.editorApi.selectBlocks(blockIdsToEdit);

    if (selectionResult.status !== "success") {
      setSendingTodos(false);
      console.log(
        `Failed to select blocks to update - ${selectionResult.message}`
      );
      return false;
    }
    if (!selectionResult.data) {
      return false;
    }

    const selectedBlocks = selectionResult.data;
    selectedBlocks.forEach(async (block) => {
      if (block.type != "textBlock" || block.listStyle.type != "todo") {
        console.log("Failed to find a todo block");
        setSendingTodos(false);
        return false;
      }

      block.listStyle.state = "checked";
      const result = await craft.dataApi.updateBlocks([block]);

      if (result.status !== "success") {
        setSendingTodos(false);
        console.log(`Failed to update blocks - ${result.message}`);
        return false;
      }

      if (!result.data) {
        setSendingTodos(false);
        console.log("Failed to update anything");
        return false;
      }

      setSendingTodos(false);
      return true;
    });
    return true;
  };

  const sendTodosToFinishEm = async (todos: Todo[]): Promise<boolean> => {
    setSendingTodos(true);
    try {
      await Promise.all(
        todos.map(async (t) => {
          const result = await craft.httpProxy.fetch({
            url: "http://localhost:8089/graphql",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: {
              type: "text",
              text: JSON.stringify({
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
            },
          });
          if (result.status != "success") {
            setSendingTodos(false);
            console.log(
              `Failed to send todos to Finish Em - ${result.message}`
            );
            return false;
          }
          return result;
        })
      );
    } catch (err) {
      `Failed to send todos to Finish Em - ${err}`;
      setSendingTodos(false);
      return false;
    }
    toast({
      position: "bottom-right",
      title: `${todos.length} todos sent`,
      status: "success",
      variant: "subtle",
      isClosable: true,
    });
    setSendingTodos(false);
    return true;
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
              const success = await sendTodosToFinishEm(todos);
              if (!success) {
                console.log("Failed to send todos to finish-em");
                setHasSubmitted(true);
                return;
              }
              await updateTodosInCraft(todos);
              setHasSubmitted(true);
              getTodosInText();
            }}
          >
            {hasSubmitted ? "Done" : "Submit"}
          </Button>
        </Flex>
      </Flex>
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
