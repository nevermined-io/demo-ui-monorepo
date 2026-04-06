import { CircleHelp } from "lucide-react"
import { Badge } from "./ui/badge"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip"
import { CodeBlock } from "./code-block"
import { useState } from "react"

const badges = [
  {
    label: "Fiat Payment",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    tooltip:
      "the payment of the Plan is done in Fiat (USD) via Stripe integration",
  },
  {
    label: "Typescript",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    tooltip: "the example is implemented using Typescript",
  },
  {
    label: "Python",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
    tooltip: "the example is implemented using Python",
  },
  {
    label: "Fixed Cost",
    className: "bg-purple-100 text-purple-800 hover:bg-purple-100",
    tooltip:
      "the cost resulting for each request sent to the AI Agent is fixed (i.e $0.01)",
  },
  {
    label: "Mcp",
    className: "bg-pink-100 text-pink-800 hover:bg-pink-100",
    tooltip:
      "the AI Agent of the example is implemented using Model Context Protocol (MCP)",
  },
  {
    label: "Observability",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
    tooltip:
      "the AI Agent tracks all the internal requests sent to the LLMs used for further analysis",
  },
]

const steps = [
  {
    text: "User opens the Weather UI and requests a forecast for a specific location",
    image: "/mcp1.png",
    desc: "During this period and as long as the agent does not recognize a user intent to request Weather information from the agent. It wont require a subscription or additional information from the user.",
  },
  {
    text: "The UI verifies if the user is a subscriber, and if missing, redirects to checkout",
    image: "/mcp2.png",
    desc: "Once the agents detect an intention from the user to request Weather information , it will check the users balance. If the user is not logged in it will require them to complete checkout process.",
    sampleCode: `
const environment = process.env.NVM_ENVIRONMENT || "staging";

if (!nvmApiKey || !planId) {
  throw new Error("Missing Nevermined API key or plan DID");
}

// Instantiate Payments Library
const payments = Payments.getInstance({
  nvmApiKey,
  environment: environment as EnvironmentName,
});

// Get balance
const balanceResult = await payments.plans.getPlanBalance(planId);
const credit = parseInt(balanceResult.balance.toString());  
const insufficientCredits = credits !== null && credits <= 0;
const needsApiKey = !apiKey;

if (needsApiKey || insufficientCredits) {
  const checkoutUrl = \`https://nevermined.app/checkout/\${encodeURIComponent(agentId)}?export=nvm-api-key&returnUrl=http://examples.nevermined.app/finance-agent/\`;
  // [...]
}
`,
  },
  {
    text: "The user pays by card and receives credits. Use the test card `4242 4242 4242 4242` with any future date and CVC.",
    image: "/s3.png",
    desc: "Integration is performed via Stripe.",
  },
  {
    text: "User returns to the Weather UI",
    image: "/s4.png",
    desc: "The checkout process will redirect the user back to the Weather ui appending the api key and the purchased plan-id.",
  },
  {
    text: "UI confirms credits and forwards the prompt to the Weather MCP",
    image: "/mcp1.png",
    desc: "The UI (MCP Client) requests an access token to the agent on behalf of the user. If it’s granted the user will be able to make a paid request via MCP transport protocol to the agent. ",
    sampleCode: `  // Get access token
  const agentAccessParams = await payments.agents.getAgentAccessToken(
    planId,
    agentId
  );

  const transport = new StreamableHTTPClientTransport(new URL(httpEndpoint), {
    requestInit: { headers: { Authorization: \`Bearer \${accessToken}\` } },
  });
  const client = new McpClient({
    name: "weather-mcp-client",
    version: "0.1.0",
  });
  await client.connect(transport);

  // Call MCP Tool
  const result = await client.callTool({
    name: "weather.today",
    arguments: { city: inputQuery },
  });
  
  return {output: result.content, txInfo: result.metadata}`,
  },
  {
    text: "MCP validates the request with NVM, processes it, and redeems credits",
    image: "/mcp67.png",
    desc: "The access token sent by the user as a MCP client request header includes information about the user, the agent and the plan id the user wants to access. Therefore the agent will validate the request start performing its task and redeem the credits from the users balance.",
  },
  {
    text: "Forecast is returned to the user",
    image: "/mcp67.png",
    desc: "Once the response is delivered to the user the task can be marked as complete. ",
  },
]

const McpAgent = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  return (
    <div className="p-12">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">
            Example - MCP Weather Agent
          </h2>
          <p className="text-gray-600 mb-4 text-sm">
            An agent connected through Model Context Protocol (MCP) to deliver
            real-time weather <br /> updates and forecasts, illustrating
            seamless pay-per-query access.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 max-w-72">
          <TooltipProvider>
            <div className="flex flex-wrap gap-2 max-w-[250px]">
              {badges.map(({ label, className, tooltip }) => (
                <Tooltip key={label}>
                  <TooltipTrigger asChild className="cursor-pointer">
                    <Badge className={className}>{label}</Badge>
                  </TooltipTrigger>
                  <TooltipContent className="bg-nvmGreen text-white max-w-60">
                    <p>{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </div>

        {/* Tags */}
      </div>

      <img src="/mcp.png" alt="" />

      <div>
        <h3 className="text-lg font-semibold mt-4 mb-2">Step-by-step flow</h3>
        <ol className="space-y-1 text-sm">
          {steps.map(({ text, image, desc, sampleCode }, index) => (
            <li
              key={index}
              className={`flex items-center ${
                hoveredIndex === index ? "text-hoverGreen" : "text-black"
              }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span>
                <span className="font-medium">{index + 1}.</span> {text}
              </span>

              <TooltipProvider>
                <Sheet>
                  <SheetTrigger asChild>
                    <div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="ml-2 cursor-pointer">
                            <CircleHelp className="h-4 w-4" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="bg-nvmGreen text-white">
                          <p>Click for more info</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </SheetTrigger>

                  <SheetContent
                    style={{ minWidth: "440px", overflowY: "auto" }}
                  >
                    <SheetHeader>
                      <SheetTitle className="text-nvmGreen">
                        Step {index + 1}
                      </SheetTitle>
                      <SheetDescription className="bg-nvmGreen text-white px-4 py-2 mt-4 rounded-md text-sm">
                        {text}
                      </SheetDescription>
                    </SheetHeader>
                    {image && (
                      <div className="mt-4">
                        <img
                          src={image}
                          alt={`Step ${index + 1}`}
                          className="rounded-lg"
                        />
                      </div>
                    )}
                    <p className="mt-4 text-sm">{desc}</p>
                    {sampleCode && <CodeBlock code={sampleCode} />}
                  </SheetContent>
                </Sheet>
              </TooltipProvider>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export default McpAgent
