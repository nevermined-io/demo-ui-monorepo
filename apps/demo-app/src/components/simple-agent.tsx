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
    label: "Licensing",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    tooltip:
      "the purchase of the Payment Plan results in a certain number of licenses/credits assigned to the buyer",
  },
  {
    label: "Typescript",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    tooltip: "the example is implemented using Typescript ",
  },
  {
    label: "Simple",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
    tooltip:
      "this is a simple agent integrated with Nevermined, ideal to understand how everything works",
  },
  {
    label: "Fixed Cost",
    className: "bg-purple-100 text-purple-800 hover:bg-purple-100",
    tooltip:
      "the cost resulting for each request sent to the AI Agent is fixed (i.e $0.01)",
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
    text: "User opens the Finance UI and requests information",
    image: "/s1.png",
    desc: "During this period and as long as the agent does not recognize a user intent to request financial information from the agent. It wont require a subscription or additional information from the user.",
  },
  {
    text: "The system checks for a subscription, and if none, user is sent to checkout",
    image: "/s2.png",
    desc: "Once the agents detect an intention from the user to request financial information , it will check the users balance. If the user is not logged in it will require them to complete checkout process.",
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
}
`,
  },
  {
    text: "The user pays by card and receives credits. Use the test card `4242 4242 4242 4242` with any future date and CVC.",
    image: "/s3.png",
    desc: "Integration is performed via Stripe.",
  },
  {
    text: "User returns to the Finance UI",
    image: "/s4.png",
    desc: "The checkout process will redirect the user back to the finance ui appending the api key and the purchased plan-id.",
  },
  {
    text: "Credits are verified and the request is sent to the Finance Agent",
    image: "/s5.png",
    desc: "The client requests an access token to the agent on behalf of the user. If it’s granted the user will be able to make a paid request to the agent. ",
    sampleCode: `
// Get access token
const agentAccessParams = await payments.agents.getAgentAccessToken(
  planId,
  agentId
);

// Send the request to the agent
const response = await fetch(agentEndpoint, {
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: \`Bearer \${agentAccessParams.accessToken}\`,
  },
  body: JSON.stringify({ input_query: inputQuery }),
});
`,
  },
  {
    text: "Agent validates with NVM, processes the request, and redeems credits",
    image: "/s67.png",
    desc: "The access token sent by the user as a request header includes information about the user, the agent and the plan id the user wants to access. Therefore the agent will validate the request start performing its task and redeem the credits from the users balance.",
    sampleCode: `
// Check for valid token
const result = await payments.requests.startProcessingRequest(
  agentId,
  authHeader, // Bearer token
  requestedUrl, // Protected endpoint
  httpVerb // POST
);

if (!result.balance.isSubscriber || result.balance.balance < 1n) {
  const error: any = new Error("Payment Required");
  error.statusCode = 402;
  throw error;
}

const requestAccessToken = authHeader.replace(/^Bearer\\s+/i, "");

// [...] Processing request (LLM call, external API call, database access, etc)

redemptionResult = await payments.requests.redeemCreditsFromRequest(
  result.agentRequestId,
  requestAccessToken,
  numberOfCredits
);
`,
  },
  {
    text: "The Response is delivered to the user",
    image: "/s67.png",
    desc: "Once the response is delivered to the user the task can be marked as complete. ",
  },
]

const SimpleAgent = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className="p-12">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">
            Example - Finance Agent
          </h2>
          <p className="text-gray-600 mb-4 text-sm">
            An AI agent that answers basic financial queries, such as balances
            or <br /> recent activity, demonstrating simple usage-based
            metering.
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 max-w-60">
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
      </div>

      <img src="/simple.png" alt="" />

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

export default SimpleAgent
