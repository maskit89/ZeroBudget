using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.HouseholdAccess;
using ZeroBudget.Application.HouseholdAccess.Commands.AcceptInvite;
using ZeroBudget.Application.HouseholdAccess.Commands.ChangeMemberRole;
using ZeroBudget.Application.HouseholdAccess.Commands.InviteMember;
using ZeroBudget.Application.HouseholdAccess.Commands.LinkMembershipMember;
using ZeroBudget.Application.HouseholdAccess.Commands.RevokeMember;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Infrastructure.Persistence;

namespace ZeroBudget.Application.Tests.Application;

/// <summary>
/// The household access flows: inviting (direct + link), redeeming a link, and changing or
/// revoking access — including the guards that protect the Owner.
/// </summary>
public class HouseholdAccessTests
{
    private const string OwnerId = "owner-1";

    private sealed class CurrentUserStub : ICurrentUser
    {
        public CurrentUserStub(string ownerId) { OwnerId = ownerId; UserId = ownerId; }
        public string? UserId { get; }
        public string? OwnerId { get; }
        public HouseholdRole? Role => HouseholdRole.Owner;
        public Guid? MemberId => null;
    }

    private sealed class FakeIdentity : IIdentityService
    {
        public readonly List<string> CreatedEmails = new();
        public readonly HashSet<string> Existing = new(StringComparer.OrdinalIgnoreCase);

        public Task<bool> EmailExistsAsync(string email) => Task.FromResult(Existing.Contains(email));
        public Task<UserAccount?> FindByEmailAsync(string email) => Task.FromResult<UserAccount?>(null);
        public Task<UserAccount?> FindByIdAsync(string userId) => Task.FromResult<UserAccount?>(null);

        public Task<CreateUserResult> CreateUserAsync(string email, string password, string? displayName)
        {
            CreatedEmails.Add(email);
            Existing.Add(email);
            return Task.FromResult(CreateUserResult.Success("user-" + Guid.NewGuid().ToString("N")[..8]));
        }

        public Task<IReadOnlyList<string>> ChangePasswordAsync(string userId, string current, string next) =>
            Task.FromResult<IReadOnlyList<string>>(Array.Empty<string>());

        public Task<CredentialCheckResult> CheckCredentialsAsync(string email, string password) =>
            Task.FromResult(CredentialCheckResult.Invalid);
    }

    private static ApplicationDbContext NewContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"zbb-access-{Guid.NewGuid()}")
            .Options);

    private static HouseholdMembership Owner() => new()
    {
        OwnerId = OwnerId,
        UserId = OwnerId,
        Role = HouseholdRole.Owner,
        Status = MembershipStatus.Active,
        InvitedEmail = "chris@x.com",
    };

    [Fact]
    public async Task Invite_direct_creates_an_active_login_membership()
    {
        using var db = NewContext();
        db.HouseholdMemberships.Add(Owner());
        await db.SaveChangesAsync();
        var identity = new FakeIdentity();

        var handler = new InviteMemberCommandHandler(db, new CurrentUserStub(OwnerId), identity);
        var result = await handler.Handle(new InviteMemberCommand(
            "liza@x.com", HouseholdRole.Admin, InviteMethod.Direct, "password123", "Liza", null), default);

        result.InviteToken.Should().BeNull();
        identity.CreatedEmails.Should().ContainSingle().Which.Should().Be("liza@x.com");

        var membership = await db.HouseholdMemberships.SingleAsync(m => m.InvitedEmail == "liza@x.com");
        membership.Status.Should().Be(MembershipStatus.Active);
        membership.Role.Should().Be(HouseholdRole.Admin);
        membership.OwnerId.Should().Be(OwnerId);
        membership.UserId.Should().NotBeNull();
    }

    [Fact]
    public async Task Invite_link_creates_a_pending_membership_and_returns_the_token_once()
    {
        using var db = NewContext();
        db.HouseholdMemberships.Add(Owner());
        await db.SaveChangesAsync();
        var identity = new FakeIdentity();

        var handler = new InviteMemberCommandHandler(db, new CurrentUserStub(OwnerId), identity);
        var result = await handler.Handle(new InviteMemberCommand(
            "liza@x.com", HouseholdRole.ReadOnly, InviteMethod.Link, null, null, null), default);

        result.InviteToken.Should().NotBeNullOrWhiteSpace();
        identity.CreatedEmails.Should().BeEmpty(); // no login until redeemed

        var membership = await db.HouseholdMemberships.SingleAsync(m => m.InvitedEmail == "liza@x.com");
        membership.Status.Should().Be(MembershipStatus.Invited);
        membership.UserId.Should().BeNull();
        membership.InviteTokenHash.Should().Be(InviteToken.Hash(result.InviteToken!));
        membership.InviteExpiresUtc.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task Invite_rejects_an_email_already_in_the_household()
    {
        using var db = NewContext();
        db.HouseholdMemberships.Add(Owner());
        db.HouseholdMemberships.Add(new HouseholdMembership
        {
            OwnerId = OwnerId, Role = HouseholdRole.Admin, Status = MembershipStatus.Invited, InvitedEmail = "liza@x.com",
        });
        await db.SaveChangesAsync();

        var handler = new InviteMemberCommandHandler(db, new CurrentUserStub(OwnerId), new FakeIdentity());
        var act = () => handler.Handle(new InviteMemberCommand(
            "liza@x.com", HouseholdRole.Admin, InviteMethod.Link, null, null, null), default);

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task Accept_invite_activates_the_membership_and_creates_the_login()
    {
        using var db = NewContext();
        var token = InviteToken.Generate();
        db.HouseholdMemberships.Add(new HouseholdMembership
        {
            OwnerId = OwnerId,
            Role = HouseholdRole.Limited,
            Status = MembershipStatus.Invited,
            InvitedEmail = "liza@x.com",
            InviteTokenHash = InviteToken.Hash(token),
            InviteExpiresUtc = DateTime.UtcNow.AddDays(3),
        });
        await db.SaveChangesAsync();
        var identity = new FakeIdentity();

        var handler = new AcceptInviteCommandHandler(db, identity);
        var result = await handler.Handle(new AcceptInviteCommand(token, "password123", "Liza"), default);

        result.Role.Should().Be(HouseholdRole.Limited);
        result.Email.Should().Be("liza@x.com");
        identity.CreatedEmails.Should().ContainSingle();

        var membership = await db.HouseholdMemberships.SingleAsync();
        membership.Status.Should().Be(MembershipStatus.Active);
        membership.UserId.Should().Be(result.UserId);
        membership.InviteTokenHash.Should().BeNull();
        membership.InviteExpiresUtc.Should().BeNull();
    }

    [Fact]
    public async Task Accept_invite_rejects_an_expired_link()
    {
        using var db = NewContext();
        var token = InviteToken.Generate();
        db.HouseholdMemberships.Add(new HouseholdMembership
        {
            OwnerId = OwnerId,
            Role = HouseholdRole.Limited,
            Status = MembershipStatus.Invited,
            InvitedEmail = "liza@x.com",
            InviteTokenHash = InviteToken.Hash(token),
            InviteExpiresUtc = DateTime.UtcNow.AddDays(-1),
        });
        await db.SaveChangesAsync();

        var handler = new AcceptInviteCommandHandler(db, new FakeIdentity());
        var act = () => handler.Handle(new AcceptInviteCommand(token, "password123", null), default);

        await act.Should().ThrowAsync<ForbiddenAccessException>();
    }

    [Fact]
    public async Task Accept_invite_rejects_an_unknown_token()
    {
        using var db = NewContext();
        var handler = new AcceptInviteCommandHandler(db, new FakeIdentity());

        var act = () => handler.Handle(new AcceptInviteCommand(InviteToken.Generate(), "password123", null), default);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Change_role_updates_a_member_but_not_the_owner()
    {
        using var db = NewContext();
        db.HouseholdMemberships.Add(Owner());
        var member = new HouseholdMembership
        {
            OwnerId = OwnerId, UserId = "user-2", Role = HouseholdRole.Admin,
            Status = MembershipStatus.Active, InvitedEmail = "liza@x.com",
        };
        db.HouseholdMemberships.Add(member);
        await db.SaveChangesAsync();

        var handler = new ChangeMemberRoleCommandHandler(db, new CurrentUserStub(OwnerId));
        var dto = await handler.Handle(new ChangeMemberRoleCommand(member.Id, HouseholdRole.ReadOnly), default);
        dto.Role.Should().Be(HouseholdRole.ReadOnly);

        var ownerMembership = await db.HouseholdMemberships.SingleAsync(m => m.Role == HouseholdRole.Owner);
        var act = () => handler.Handle(new ChangeMemberRoleCommand(ownerMembership.Id, HouseholdRole.Admin), default);
        await act.Should().ThrowAsync<ForbiddenAccessException>();
    }

    [Fact]
    public async Task Revoke_removes_a_member_but_never_the_owner()
    {
        using var db = NewContext();
        var owner = Owner();
        db.HouseholdMemberships.Add(owner);
        var member = new HouseholdMembership
        {
            OwnerId = OwnerId, UserId = "user-2", Role = HouseholdRole.Limited,
            Status = MembershipStatus.Active, InvitedEmail = "liza@x.com",
        };
        db.HouseholdMemberships.Add(member);
        await db.SaveChangesAsync();

        var handler = new RevokeMemberCommandHandler(db, new CurrentUserStub(OwnerId));
        await handler.Handle(new RevokeMemberCommand(member.Id), default);
        (await db.HouseholdMemberships.CountAsync()).Should().Be(1);

        var act = () => handler.Handle(new RevokeMemberCommand(owner.Id), default);
        await act.Should().ThrowAsync<ForbiddenAccessException>();
    }

    private static HouseholdMembership ActiveLogin(string userId, string email, Guid? memberId = null) => new()
    {
        OwnerId = OwnerId, UserId = userId, Role = HouseholdRole.Admin,
        Status = MembershipStatus.Active, InvitedEmail = email, MemberId = memberId,
    };

    [Fact]
    public async Task Invite_rejects_linking_a_budget_person_already_linked_to_another_login()
    {
        using var db = NewContext();
        db.HouseholdMemberships.Add(Owner());
        var member = new HouseholdMember { OwnerId = OwnerId, Name = "Liza", DisplayOrder = 0 };
        db.HouseholdMembers.Add(member);
        db.HouseholdMemberships.Add(ActiveLogin("user-2", "liza@x.com", member.Id));
        await db.SaveChangesAsync();

        var handler = new InviteMemberCommandHandler(db, new CurrentUserStub(OwnerId), new FakeIdentity());
        var act = () => handler.Handle(new InviteMemberCommand(
            "new@x.com", HouseholdRole.Limited, InviteMethod.Link, null, null, member.Id), default);

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task Link_connects_a_login_to_a_budget_person_and_can_unlink()
    {
        using var db = NewContext();
        db.HouseholdMemberships.Add(Owner());
        var member = new HouseholdMember { OwnerId = OwnerId, Name = "Liza", DisplayOrder = 0 };
        db.HouseholdMembers.Add(member);
        var login = ActiveLogin("user-2", "liza@x.com");
        db.HouseholdMemberships.Add(login);
        await db.SaveChangesAsync();

        var handler = new LinkMembershipMemberCommandHandler(db, new CurrentUserStub(OwnerId));

        var linked = await handler.Handle(new LinkMembershipMemberCommand(login.Id, member.Id), default);
        linked.MemberId.Should().Be(member.Id);

        var unlinked = await handler.Handle(new LinkMembershipMemberCommand(login.Id, null), default);
        unlinked.MemberId.Should().BeNull();
    }

    [Fact]
    public async Task Link_rejects_a_budget_person_already_linked_to_another_login()
    {
        using var db = NewContext();
        db.HouseholdMemberships.Add(Owner());
        var member = new HouseholdMember { OwnerId = OwnerId, Name = "Liza", DisplayOrder = 0 };
        db.HouseholdMembers.Add(member);
        db.HouseholdMemberships.Add(ActiveLogin("user-2", "liza@x.com", member.Id));
        var other = ActiveLogin("user-3", "sam@x.com");
        db.HouseholdMemberships.Add(other);
        await db.SaveChangesAsync();

        var handler = new LinkMembershipMemberCommandHandler(db, new CurrentUserStub(OwnerId));
        var act = () => handler.Handle(new LinkMembershipMemberCommand(other.Id, member.Id), default);

        await act.Should().ThrowAsync<ValidationException>();
    }
}
