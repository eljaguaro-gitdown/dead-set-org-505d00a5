import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CollaboratorInfo {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
}

interface CollaboratorAvatarsProps {
  collaborators: CollaboratorInfo[];
  creatorName?: string;
}

const COLORS = [
  "bg-primary text-primary-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-accent text-accent-foreground",
  "bg-dead-gold text-accent-foreground",
];

const CollaboratorAvatars = ({ collaborators, creatorName }: CollaboratorAvatarsProps) => {
  const allPeople = [
    ...(creatorName ? [{ userId: "owner", displayName: creatorName, avatarUrl: null, role: "owner" }] : []),
    ...collaborators,
  ];

  if (allPeople.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2">
      {allPeople.slice(0, 5).map((person, i) => {
        const initials = person.displayName
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

        return (
          <Tooltip key={person.userId}>
            <TooltipTrigger asChild>
              <Avatar className={`w-7 h-7 border-2 border-background cursor-default ${COLORS[i % COLORS.length]}`}>
                <AvatarFallback className={`text-[10px] font-body font-medium ${COLORS[i % COLORS.length]}`}>
                  {initials}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent className="bg-card border-border text-card-foreground font-body text-xs">
              {person.displayName} ({person.role})
            </TooltipContent>
          </Tooltip>
        );
      })}
      {allPeople.length > 5 && (
        <Avatar className="w-7 h-7 border-2 border-background bg-muted">
          <AvatarFallback className="text-[10px] font-body text-muted-foreground">
            +{allPeople.length - 5}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default CollaboratorAvatars;
