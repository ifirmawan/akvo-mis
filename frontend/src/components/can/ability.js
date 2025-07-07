import { AbilityBuilder, createMongoAbility } from "@casl/ability";

const defineAbilityFor = (user) => {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

  // Return basic ability with no permissions if user is null
  if (!user) {
    cannot("manage", "all");
    return build();
  }
  if (user?.is_superuser) {
    can("manage", "all");
  } else if (user) {
    const roles = user?.roles || [];
    const is_approver = roles.filter((r) => r?.is_approver).length > 0;
    const is_submitter = roles.filter((r) => r?.is_submitter).length > 0;
    const is_editor = roles.filter((r) => r?.is_mobile).length > 0;

    if (is_approver) {
      can("manage", "approvals");
    }
    if (is_submitter) {
      can("manage", "draft");
      can("manage", "submissions");
      can("manage", "mobile");
      can("create", "downloads");
      can("edit", "data", { created_by: user.email });
    }
    if (is_editor) {
      can("edit", "data");
      can("upload", "data");
    }
    can("read", "data");
    can("read", "downloads");
    can("read", "approvals");
    can("read", "approvers");
    can("manage", "form");
    can("manage", "control-center");
    can("manage", "profile");

    cannot("manage", "roles");
    cannot("manage", "user");
    cannot("manage", "master-data");
    cannot("manage", "settings");
  }
  return build();
};

export const ability = (user) => {
  return defineAbilityFor(user);
};
